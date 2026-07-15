import { X, Printer, Download, Receipt } from 'lucide-react';

interface InvoiceDetailProps {
  isOpen: boolean;
  onClose: () => void;
  booking: any;
  breakdown: {
    baseCharges: number;
    lateCheckOutFee: number;
    miniBarCharges: number;
    laundryCharges: number;
    restaurantCharges: number;
    cafeCharges: number;
    barCharges: number;
    roomServiceCharges: number;
    discount: number;
    gst: number;
    advancePaid: number;
    grandTotal: number;
  };
}

export default function InvoiceDetail({ isOpen, onClose, booking, breakdown }: InvoiceDetailProps) {
  if (!isOpen) return null;

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-white text-slate-900 rounded-3xl max-w-2xl w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col my-8">
        
        {/* Header toolbar (Hidden during print) */}
        <div className="print:hidden border-b border-slate-100 px-6 py-4 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-2 font-bold text-slate-800">
            <Receipt className="w-5 h-5 text-primary" />
            <span>Invoice Terminal</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 text-white hover:bg-slate-800 text-xs font-bold transition-all"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print Receipt</span>
            </button>
            <button
              onClick={handlePrint} // Print can trigger print-to-pdf natively in browser
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 text-slate-700 hover:bg-slate-200 text-xs font-bold transition-all"
            >
              <Download className="w-3.5 h-3.5" />
              <span>PDF</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 hover:bg-slate-200 rounded-xl transition-all"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Invoice Body Content */}
        <div id="print-area" className="p-8 space-y-6 overflow-y-auto">
          {/* Logo & Company details */}
          <div className="flex justify-between items-start gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-xl bg-slate-950 flex items-center justify-center text-white font-black text-lg">H</div>
                <span className="text-xl font-black tracking-tight">Grand Horizon Hotel</span>
              </div>
              <p className="text-xs text-slate-500 max-w-xs">
                143 Royal Avenue, Downtown City<br />
                Phone: +1 555 0177 · Email: billing@grandhorizon.com<br />
                <strong>GSTIN:</strong> GSTIN123456789
              </p>
            </div>
            <div className="text-right space-y-1">
              <h1 className="text-2xl font-black uppercase text-slate-800 tracking-tight">Tax Invoice</h1>
              <p className="text-xs text-slate-500">
                <strong>Invoice No:</strong> {booking?.bookingNumber ? `INV-${booking.bookingNumber.slice(3)}` : 'INV-TEMP'}<br />
                <strong>Date:</strong> {new Date().toLocaleDateString()}<br />
                <strong>Status:</strong> <span className="text-emerald-600 font-bold">PAID</span>
              </p>
            </div>
          </div>

          <hr className="border-slate-200" />

          {/* Guest & Booking details */}
          <div className="grid grid-cols-2 gap-6 text-xs">
            <div className="space-y-1">
              <h3 className="font-extrabold uppercase text-slate-400 tracking-widest text-[9px]">Bill To</h3>
              <p className="font-bold text-slate-800 text-sm">{booking?.guest?.fullName || 'Guest Name'}</p>
              <p className="text-slate-500">
                Phone: {booking?.guest?.phone || 'N/A'}<br />
                Email: {booking?.guest?.email || 'N/A'}<br />
                ID Proof: {booking?.guest?.idProof || 'N/A'} · Nationality: {booking?.guest?.nationality || 'N/A'}
              </p>
            </div>
            <div className="space-y-1">
              <h3 className="font-extrabold uppercase text-slate-400 tracking-widest text-[9px]">Reservation Details</h3>
              <p className="text-slate-600">
                <strong>Room Assignment:</strong> Room {booking?.room?.number || 'N/A'} ({booking?.roomType?.name || 'N/A'})<br />
                <strong>Check-in:</strong> {booking?.checkIn ? new Date(booking.checkIn).toLocaleDateString() : 'N/A'}<br />
                <strong>Check-out:</strong> {booking?.checkOut ? new Date(booking.checkOut).toLocaleDateString() : 'N/A'}<br />
                <strong>Nights Count:</strong> {booking?.nights || 1} Night(s)
              </p>
            </div>
          </div>

          {/* Table Breakdown */}
          <div className="border border-slate-200 rounded-2xl overflow-hidden text-xs">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 font-bold text-slate-700">
                  <th className="px-4 py-3">Charge Description</th>
                  <th className="px-4 py-3 text-right">Amount (USD)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-600">
                <tr>
                  <td className="px-4 py-2.5">Room Charges ({booking?.nights || 1} nights @ ${Number(booking?.rate || 0).toFixed(2)})</td>
                  <td className="px-4 py-2.5 text-right">${breakdown.baseCharges.toFixed(2)}</td>
                </tr>
                {breakdown.lateCheckOutFee > 0 && (
                  <tr>
                    <td className="px-4 py-2.5">Late Check-Out Fee</td>
                    <td className="px-4 py-2.5 text-right">${breakdown.lateCheckOutFee.toFixed(2)}</td>
                  </tr>
                )}
                {breakdown.miniBarCharges > 0 && (
                  <tr>
                    <td className="px-4 py-2.5">Mini Bar Usage</td>
                    <td className="px-4 py-2.5 text-right">${breakdown.miniBarCharges.toFixed(2)}</td>
                  </tr>
                )}
                {breakdown.laundryCharges > 0 && (
                  <tr>
                    <td className="px-4 py-2.5">Laundry Services</td>
                    <td className="px-4 py-2.5 text-right">${breakdown.laundryCharges.toFixed(2)}</td>
                  </tr>
                )}
                {breakdown.restaurantCharges > 0 && (
                  <tr>
                    <td className="px-4 py-2.5">Restaurant Dining Bills</td>
                    <td className="px-4 py-2.5 text-right">${breakdown.restaurantCharges.toFixed(2)}</td>
                  </tr>
                )}
                {breakdown.cafeCharges > 0 && (
                  <tr>
                    <td className="px-4 py-2.5">Cafe Bistro Bills</td>
                    <td className="px-4 py-2.5 text-right">${breakdown.cafeCharges.toFixed(2)}</td>
                  </tr>
                )}
                {breakdown.barCharges > 0 && (
                  <tr>
                    <td className="px-4 py-2.5">Velvet Bar Lounge Bills</td>
                    <td className="px-4 py-2.5 text-right">${breakdown.barCharges.toFixed(2)}</td>
                  </tr>
                )}
                {breakdown.roomServiceCharges > 0 && (
                  <tr>
                    <td className="px-4 py-2.5">In-Room Dining Requests</td>
                    <td className="px-4 py-2.5 text-right">${breakdown.roomServiceCharges.toFixed(2)}</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Pricing Totals & QR code */}
          <div className="flex justify-between items-end gap-6 pt-2">
            <div>
              {/* QR Code */}
              <div className="p-1 border border-slate-200 rounded-xl bg-white w-28 h-28 flex items-center justify-center">
                <img 
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=INV-${booking?.bookingNumber}`} 
                  alt="Payment QR Code" 
                  className="w-full h-full"
                />
              </div>
              <p className="text-[10px] text-slate-400 mt-1.5 font-bold tracking-wide">Scan for digital invoice record</p>
            </div>
            
            <div className="w-72 space-y-2 text-xs">
              <div className="flex justify-between text-slate-500">
                <span>Subtotal:</span>
                <span>${(breakdown.baseCharges + breakdown.lateCheckOutFee + breakdown.miniBarCharges + breakdown.laundryCharges + breakdown.restaurantCharges + breakdown.cafeCharges + breakdown.barCharges + breakdown.roomServiceCharges).toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-slate-500">
                <span>Discount Applied:</span>
                <span className="text-rose-600">-${breakdown.discount.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-slate-500">
                <span>GST (18%):</span>
                <span>+${breakdown.gst.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-slate-500 border-t border-slate-100 pt-2">
                <span>Advance Paid:</span>
                <span>-${breakdown.advancePaid.toFixed(2)}</span>
              </div>
              <div className="flex justify-between font-black text-sm text-slate-900 border-t border-slate-200 pt-2">
                <span>Grand Total Paid:</span>
                <span>${breakdown.grandTotal.toFixed(2)}</span>
              </div>
            </div>
          </div>

          <hr className="border-slate-200" />
          
          <div className="text-center text-[10px] text-slate-400 leading-normal">
            Thank you for staying at Grand Horizon Luxury Hotel.<br />
            This is a computer-generated tax invoice and requires no physical signature.
          </div>
        </div>

      </div>
    </div>
  );
}
