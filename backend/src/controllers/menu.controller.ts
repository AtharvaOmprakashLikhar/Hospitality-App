import { Request, Response } from 'express';
import sharp from 'sharp';
import path from 'path';
import fs from 'fs';
import { prisma } from '../db';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import { logAudit } from '../utils/audit';

/**
 * POST /api/menu/venues
 * ADMIN only. Creates a menu venue.
 */
export async function createVenue(req: AuthenticatedRequest, res: Response) {
  try {
    const propertyId = req.user?.propertyId;
    const creatorId = req.user?.id;

    if (!propertyId || !creatorId) {
      return res.status(403).json({ error: 'Property scope missing' });
    }

    const { type, name } = req.body;
    if (!type || !name) {
      return res.status(400).json({ error: 'Venue type and name are required' });
    }

    const venue = await prisma.menuVenue.create({
      data: {
        propertyId,
        type,
        name
      }
    });

    // Write audit log
    await logAudit(propertyId, creatorId, 'CREATE', 'MenuVenue', venue.id, venue);

    res.status(201).json(venue);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to create venue' });
  }
}

/**
 * GET /api/menu/venues
 * Public-readable. Fetches all venues for the property.
 */
export async function getVenues(req: AuthenticatedRequest, res: Response) {
  try {
    const propertyId = req.user?.propertyId;
    if (!propertyId) {
      return res.status(403).json({ error: 'Property scope missing' });
    }

    const venues = await prisma.menuVenue.findMany({
      where: { propertyId },
      orderBy: { name: 'asc' }
    });

    res.json(venues);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to fetch venues' });
  }
}

/**
 * POST /api/menu/items
 * ADMIN & MANAGER. Creates a menu item.
 */
export async function createMenuItem(req: AuthenticatedRequest, res: Response) {
  try {
    const propertyId = req.user?.propertyId;
    const creatorId = req.user?.id;

    if (!propertyId || !creatorId) {
      return res.status(403).json({ error: 'Property scope missing' });
    }

    const { venueId, name, description, category, price, isVeg, isAvailable, corkageAllowed, corkageFee } = req.body;

    if (!venueId || !name || !category || price === undefined) {
      return res.status(400).json({ error: 'venueId, name, category, and price are required' });
    }

    // Verify venue exists in this property
    const venue = await prisma.menuVenue.findFirst({
      where: { id: venueId, propertyId }
    });

    if (!venue) {
      return res.status(404).json({ error: 'Venue not found in this property' });
    }

    const item = await prisma.menuItem.create({
      data: {
        venueId,
        name,
        description,
        category,
        price: parseFloat(price),
        isVeg: isVeg !== undefined ? Boolean(isVeg) : true,
        isAvailable: isAvailable !== undefined ? Boolean(isAvailable) : true,
        corkageAllowed: corkageAllowed !== undefined ? Boolean(corkageAllowed) : false,
        corkageFee: corkageFee ? parseFloat(corkageFee) : null,
        createdBy: creatorId
      }
    });

    // Write audit log
    await logAudit(propertyId, creatorId, 'CREATE', 'MenuItem', item.id, item);

    res.status(201).json(item);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to create menu item' });
  }
}

/**
 * PATCH /api/menu/items/:id
 * ADMIN & MANAGER. Updates a menu item.
 */
export async function updateMenuItem(req: AuthenticatedRequest, res: Response) {
  try {
    const propertyId = req.user?.propertyId;
    const updaterId = req.user?.id;

    if (!propertyId || !updaterId) {
      return res.status(403).json({ error: 'Property scope missing' });
    }

    const { id } = req.params;
    const { name, description, category, price, isVeg, isAvailable, corkageAllowed, corkageFee } = req.body;

    const existing = await prisma.menuItem.findFirst({
      where: { id, venue: { propertyId } }
    });

    if (!existing) {
      return res.status(404).json({ error: 'Menu item not found in this property' });
    }

    const updated = await prisma.menuItem.update({
      where: { id },
      data: {
        name,
        description,
        category,
        price: price !== undefined ? parseFloat(price) : undefined,
        isVeg: isVeg !== undefined ? Boolean(isVeg) : undefined,
        isAvailable: isAvailable !== undefined ? Boolean(isAvailable) : undefined,
        corkageAllowed: corkageAllowed !== undefined ? Boolean(corkageAllowed) : undefined,
        corkageFee: corkageFee !== undefined ? (corkageFee ? parseFloat(corkageFee) : null) : undefined,
        updatedBy: updaterId
      }
    });

    // Write audit log
    await logAudit(propertyId, updaterId, 'UPDATE', 'MenuItem', id, {
      before: existing,
      after: updated
    });

    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to update menu item' });
  }
}

/**
 * DELETE /api/menu/items/:id
 * ADMIN & MANAGER. Soft deletes by setting isAvailable = false and deletedAt = now.
 */
export async function deleteMenuItem(req: AuthenticatedRequest, res: Response) {
  try {
    const propertyId = req.user?.propertyId;
    const updaterId = req.user?.id;

    if (!propertyId || !updaterId) {
      return res.status(403).json({ error: 'Property scope missing' });
    }

    const { id } = req.params;

    const existing = await prisma.menuItem.findFirst({
      where: { id, venue: { propertyId }, deletedAt: null }
    });

    if (!existing) {
      return res.status(404).json({ error: 'Menu item not found or already deleted' });
    }

    const deleted = await prisma.menuItem.update({
      where: { id },
      data: {
        isAvailable: false,
        deletedAt: new Date(),
        updatedBy: updaterId
      }
    });

    // Write audit log
    await logAudit(propertyId, updaterId, 'DELETE', 'MenuItem', id, {
      before: existing,
      after: deleted
    });

    res.json({ message: 'Menu item soft-deleted successfully', item: deleted });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to delete menu item' });
  }
}

/**
 * POST /api/menu/items/:id/image
 * ADMIN & MANAGER. Handle multer file upload, sharp resize + thumbnail.
 */
export async function uploadMenuItemImage(req: AuthenticatedRequest, res: Response) {
  try {
    const propertyId = req.user?.propertyId;
    const updaterId = req.user?.id;

    if (!propertyId || !updaterId) {
      return res.status(403).json({ error: 'Property scope missing' });
    }

    const { id } = req.params;

    const existing = await prisma.menuItem.findFirst({
      where: { id, venue: { propertyId } }
    });

    if (!existing) {
      return res.status(404).json({ error: 'Menu item not found' });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'No image file uploaded' });
    }

    const file = req.file;
    const originalPath = file.path;
    const ext = path.extname(file.originalname);
    const baseName = `${id}-${Date.now()}`;

    const outputDir = path.dirname(originalPath);
    const mainFileName = `${baseName}-1200${ext}`;
    const thumbFileName = `${baseName}-300${ext}`;

    const mainFilePath = path.join(outputDir, mainFileName);
    const thumbFilePath = path.join(outputDir, thumbFileName);

    // Sharp processes:
    // Resize main image to max 1200px width
    await sharp(originalPath)
      .resize({ width: 1200, withoutEnlargement: true })
      .toFile(mainFilePath);

    // Create a 300px width thumbnail
    await sharp(originalPath)
      .resize({ width: 300, withoutEnlargement: true })
      .toFile(thumbFilePath);

    // Clean up original file
    fs.unlinkSync(originalPath);

    const imageUrl = `/uploads/${mainFileName}`;

    const updated = await prisma.menuItem.update({
      where: { id },
      data: {
        imageUrl,
        updatedBy: updaterId
      }
    });

    // Write audit log
    await logAudit(propertyId, updaterId, 'UPDATE', 'MenuItem', id, {
      imageUrlBefore: existing.imageUrl,
      imageUrlAfter: imageUrl
    });

    res.json({ imageUrl, item: updated });
  } catch (err: any) {
    // Attempt cleanup if error occurs
    if (req.file && fs.existsSync(req.file.path)) {
      try { fs.unlinkSync(req.file.path); } catch {}
    }
    res.status(500).json({ error: err.message || 'Image processing failed' });
  }
}

/**
 * GET /api/menu/venues/:venueId/items
 * Public readable. Returns items for a venue.
 */
export async function getVenueItems(req: Request, res: Response) {
  try {
    const { venueId } = req.params;
    const { category, available } = req.query;

    const where: any = { venueId, deletedAt: null };

    if (category) {
      where.category = category as string;
    }

    if (available !== undefined) {
      where.isAvailable = available === 'true';
    }

    const items = await prisma.menuItem.findMany({
      where,
      orderBy: { category: 'asc' }
    });

    res.json(items);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to fetch menu items' });
  }
}
