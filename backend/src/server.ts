import express from 'express';
import cors from 'cors';
import http from 'http';
import { Server } from 'socket.io';
import path from 'path';
import dotenv from 'dotenv';

// Import Route modules
import themeRouter from './routes/theme.routes';
import authRouter from './routes/auth.routes';
import staffRouter from './routes/staff.routes';
import attendanceRouter from './routes/attendance.routes';
import salaryRouter from './routes/salary.routes';
import menuRouter from './routes/menu.routes';
import orderRouter from './routes/order.routes';
import reservationRouter from './routes/reservations.routes';
import hotelRouter from './routes/hotel.routes';
import hospitalityRouter from './routes/hospitality.routes';
import roomsRouter from './routes/rooms.routes';

// Import seed utility
import { seedDatabase } from './utils/seed';

dotenv.config();

export const app = express();
export const server = http.createServer(app);
export const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static uploads
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Register Routes
app.use('/api/theme', themeRouter);
app.use('/api/auth', authRouter);
app.use('/api/staff/assignments', staffRouter);
app.use('/api/attendance', attendanceRouter); // Handles both attendance & leave
app.use('/api/salary', salaryRouter);
app.use('/api/menu', menuRouter);
app.use('/api/orders', orderRouter);
app.use('/api/reservations', reservationRouter);
app.use('/api/hotel', hotelRouter);
app.use('/api/hospitality', hospitalityRouter);
app.use('/api/rooms', roomsRouter);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', environment: process.env.NODE_ENV || 'development' });
});

// Socket.io Event Handling
io.on('connection', (socket) => {
  console.log(`Socket client connected: ${socket.id}`);
  
  socket.on('join_tenant', (tenantId: string) => {
    socket.join(tenantId);
    console.log(`Socket ${socket.id} joined tenant channel: ${tenantId}`);
  });

  socket.on('join_property', (propertyId: string) => {
    socket.join(propertyId);
    console.log(`Socket ${socket.id} joined property channel: ${propertyId}`);
  });

  socket.on('disconnect', () => {
    console.log(`Socket client disconnected: ${socket.id}`);
  });
});

// Global Error Middleware
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error("Express App Error:", err);
  res.status(500).json({ error: err.message || 'Internal Server Error' });
});

// Database Auto-seeding and Server Listening
if (!process.env.VERCEL) {
  server.listen(PORT, async () => {
    console.log(`HospitalityOS Backend running on port ${PORT}`);
    // Run seed check
    await seedDatabase();
  });
} else {
  console.log('Running backend in Vercel Serverless environment');
}

export default app;
