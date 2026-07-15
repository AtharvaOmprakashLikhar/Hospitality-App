import { Request, Response } from 'express';
import { prisma } from '../db';

// Local copy of DEFAULT_THEME to avoid path issues if workspaces compile separately
const BACKEND_DEFAULT_THEME = {
  primary: "220 90% 56%",
  secondary: "160 84% 39%",
  bgLight: "210 20% 98%",
  bgDark: "224 71% 4%",
  surfaceLight: "0 0% 100%",
  surfaceDark: "224 71% 8%",
  textLight: "220 15% 10%",
  textDark: "210 20% 98%",
  btn: "220 90% 56%",
  btnHover: "220 90% 48%",
  btnActive: "220 90% 40%",
  btnDisabled: "220 10% 80%",
  borderLight: "220 12% 90%",
  borderDark: "220 12% 20%",
};

/**
 * Helper to ensure a tenant and theme config exist (seeds default if not found)
 */
async function ensureTenant(tenantId: string) {
  let tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    include: { themeConfig: true }
  });

  if (!tenant) {
    // Check if there's any tenant at all
    const firstTenant = await prisma.tenant.findFirst({
      include: { themeConfig: true }
    });

    if (firstTenant) {
      return firstTenant;
    }

    // Otherwise, create a default tenant and theme
    tenant = await prisma.tenant.create({
      data: {
        id: tenantId === 'default-tenant-uuid' ? undefined : tenantId,
        name: "Cafe Prime (Default Workspace)",
        themeConfig: {
          create: {
            ...BACKEND_DEFAULT_THEME
          }
        }
      },
      include: { themeConfig: true }
    });
  }

  return tenant;
}

/**
 * GET /api/theme/:tenantId
 */
export async function getThemeConfig(req: Request, res: Response) {
  try {
    const { tenantId } = req.params;
    const tenant = await ensureTenant(tenantId);
    
    const themeVersions = await prisma.themeVersion.findMany({
      where: { tenantId: tenant.id },
      orderBy: { createdAt: 'desc' }
    });

    res.json({
      id: tenant.id,
      name: tenant.name,
      logoUrl: tenant.logoUrl,
      themeConfig: tenant.themeConfig,
      themeVersions
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to load theme settings" });
  }
}

/**
 * POST /api/theme/:tenantId/save
 */
export async function saveThemeConfig(req: Request, res: Response) {
  try {
    const { tenantId } = req.params;
    const themeData = req.body;

    const tenant = await ensureTenant(tenantId);
    const activeConfig = tenant.themeConfig;

    // Save previous config to history if it exists
    if (activeConfig) {
      await prisma.themeVersion.create({
        data: {
          tenantId: tenant.id,
          primary: activeConfig.primary,
          secondary: activeConfig.secondary,
          bgLight: activeConfig.bgLight,
          bgDark: activeConfig.bgDark,
          surfaceLight: activeConfig.surfaceLight,
          surfaceDark: activeConfig.surfaceDark,
          textLight: activeConfig.textLight,
          textDark: activeConfig.textDark,
          btn: activeConfig.btn,
          btnHover: activeConfig.btnHover,
          btnActive: activeConfig.btnActive,
          btnDisabled: activeConfig.btnDisabled,
          borderLight: activeConfig.borderLight,
          borderDark: activeConfig.borderDark,
        }
      });
    }

    // Update current active config
    const updatedConfig = await prisma.themeConfig.update({
      where: { tenantId: tenant.id },
      data: {
        primary: themeData.primary,
        secondary: themeData.secondary,
        bgLight: themeData.bgLight,
        bgDark: themeData.bgDark,
        surfaceLight: themeData.surfaceLight,
        surfaceDark: themeData.surfaceDark,
        textLight: themeData.textLight,
        textDark: themeData.textDark,
        btn: themeData.btn,
        btnHover: themeData.btnHover,
        btnActive: themeData.btnActive,
        btnDisabled: themeData.btnDisabled,
        borderLight: themeData.borderLight,
        borderDark: themeData.borderDark,
      }
    });

    const themeVersions = await prisma.themeVersion.findMany({
      where: { tenantId: tenant.id },
      orderBy: { createdAt: 'desc' }
    });

    res.json({
      themeConfig: updatedConfig,
      themeVersions
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to save theme settings" });
  }
}

/**
 * POST /api/theme/:tenantId/revert
 */
export async function revertThemeConfig(req: Request, res: Response) {
  try {
    const { tenantId } = req.params;
    const { versionId } = req.body;

    const tenant = await ensureTenant(tenantId);

    // Fetch version parameters
    const version = await prisma.themeVersion.findFirst({
      where: { id: versionId, tenantId: tenant.id }
    });

    if (!version) {
      return res.status(404).json({ error: "Theme history version not found" });
    }

    // Update active theme config with version settings
    const updatedConfig = await prisma.themeConfig.update({
      where: { tenantId: tenant.id },
      data: {
        primary: version.primary,
        secondary: version.secondary,
        bgLight: version.bgLight,
        bgDark: version.bgDark,
        surfaceLight: version.surfaceLight,
        surfaceDark: version.surfaceDark,
        textLight: version.textLight,
        textDark: version.textDark,
        btn: version.btn,
        btnHover: version.btnHover,
        btnActive: version.btnActive,
        btnDisabled: version.btnDisabled,
        borderLight: version.borderLight,
        borderDark: version.borderDark,
      }
    });

    const themeVersions = await prisma.themeVersion.findMany({
      where: { tenantId: tenant.id },
      orderBy: { createdAt: 'desc' }
    });

    res.json({
      themeConfig: updatedConfig,
      themeVersions
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to revert theme" });
  }
}

/**
 * POST /api/theme/:tenantId/reset
 */
export async function resetThemeConfig(req: Request, res: Response) {
  try {
    const { tenantId } = req.params;
    const tenant = await ensureTenant(tenantId);

    // Save previous config to history before reset
    if (tenant.themeConfig) {
      await prisma.themeVersion.create({
        data: {
          tenantId: tenant.id,
          primary: tenant.themeConfig.primary,
          secondary: tenant.themeConfig.secondary,
          bgLight: tenant.themeConfig.bgLight,
          bgDark: tenant.themeConfig.bgDark,
          surfaceLight: tenant.themeConfig.surfaceLight,
          surfaceDark: tenant.themeConfig.surfaceDark,
          textLight: tenant.themeConfig.textLight,
          textDark: tenant.themeConfig.textDark,
          btn: tenant.themeConfig.btn,
          btnHover: tenant.themeConfig.btnHover,
          btnActive: tenant.themeConfig.btnActive,
          btnDisabled: tenant.themeConfig.btnDisabled,
          borderLight: tenant.themeConfig.borderLight,
          borderDark: tenant.themeConfig.borderDark,
        }
      });
    }

    // Reset config and clear logo
    const updatedConfig = await prisma.themeConfig.update({
      where: { tenantId: tenant.id },
      data: {
        ...BACKEND_DEFAULT_THEME
      }
    });

    await prisma.tenant.update({
      where: { id: tenant.id },
      data: { logoUrl: null }
    });

    const themeVersions = await prisma.themeVersion.findMany({
      where: { tenantId: tenant.id },
      orderBy: { createdAt: 'desc' }
    });

    res.json({
      themeConfig: updatedConfig,
      themeVersions
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to reset theme" });
  }
}

/**
 * POST /api/theme/:tenantId/upload-logo
 */
export async function uploadLogo(req: Request, res: Response) {
  try {
    const { tenantId } = req.params;
    const tenant = await ensureTenant(tenantId);

    // Handle delete if body contains logoUrl = null
    if (req.body && req.body.logoUrl === null) {
      await prisma.tenant.update({
        where: { id: tenant.id },
        data: { logoUrl: null }
      });
      return res.json({ logoUrl: null });
    }

    if (!req.file) {
      return res.status(400).json({ error: "No logo file uploaded" });
    }

    const fileUrl = `/uploads/${req.file.filename}`;

    // Save url in database
    await prisma.tenant.update({
      where: { id: tenant.id },
      data: { logoUrl: fileUrl }
    });

    res.json({ logoUrl: fileUrl });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to upload logo" });
  }
}
