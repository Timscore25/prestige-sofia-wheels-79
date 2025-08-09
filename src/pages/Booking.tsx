import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { cars } from '@/data/fleet-data';
import { transfers } from '@/data/transfer-data';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { v4 as uuidv4 } from 'uuid';

const Booking = () => {
  const { toast } = useToast();
  const [searchParams] = useSearchParams();
  const [pickupDate, setPickupDate] = useState<Date>();
  const [returnDate, setReturnDate] = useState<Date>();
  const [pickupTime, setPickupTime] = useState<string>("10:00");
  const [returnTime, setReturnTime] = useState<string>("18:00");
  const [surcharge, setSurcharge] = useState<number>(0);
  const [discount, setDiscount] = useState<number>(0);
  const [discountPercent, setDiscountPercent] = useState<number>(0);
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    vehicle: '',
    pickupLocation: 'airport',
    dropOffLocation: '',
    deliveryAddress: '',
    specialRequests: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isTransfer = searchParams.get('transferType') === 'transfer';

  // Pre-fill form with URL parameters
  useEffect(() => {
    const urlPickupDate = searchParams.get('pickupDate');
    const urlReturnDate = searchParams.get('returnDate');
    const urlVehicle = searchParams.get('vehicle');
    const urlTransferType = searchParams.get('transferType');

    if (urlPickupDate) {
      setPickupDate(new Date(urlPickupDate));
    }
    if (urlReturnDate) {
      setReturnDate(new Date(urlReturnDate));
    }
    if (urlVehicle) {
      setFormData(prev => ({ ...prev, vehicle: urlVehicle }));
    }
    if (urlTransferType === 'transfer') {
      setFormData(prev => ({ 
        ...prev, 
        specialRequests: 'Transfer service requested'
      }));
    }
  }, [searchParams]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  // Helper function to check if time is between 00:00 and 07:59 (handles both 24-hour and 12-hour formats)
  const isNightTime = (time: string): boolean => {
    if (!time) return false;
    
    // Handle 12-hour format (e.g., "5:00 AM", "5:00 am", "12:00 AM")
    if (time.toLowerCase().includes('am') || time.toLowerCase().includes('pm')) {
      const [timePart, period] = time.split(/\s+/);
      const [hours, minutes] = timePart.split(':').map(Number);
      let hour24 = hours;
      
      if (period.toLowerCase() === 'am') {
        if (hours === 12) hour24 = 0; // 12:xx AM becomes 0:xx
      } else if (period.toLowerCase() === 'pm') {
        if (hours !== 12) hour24 = hours + 12; // PM hours except 12:xx PM
      }
      
      return hour24 >= 0 && hour24 < 8;
    }
    
    // Handle 24-hour format (e.g., "05:00", "17:30")
    const [hours] = time.split(':').map(Number);
    return hours >= 0 && hours < 8;
  };

  // Helper function to calculate time-based surcharge
  const calculateTimeSurcharge = (): number => {
    if (!pickupTime) return 0;
    
    const isPickupNight = isNightTime(pickupTime);
    const isReturnNight = !isTransfer && returnTime ? isNightTime(returnTime) : false;
    
    if (isTransfer) {
      // For transfers, only check pickup time
      return isPickupNight ? 30 : 0;
    } else {
      // For rentals, calculate based on both times
      return (isPickupNight ? 30 : 0) + (isReturnNight ? 30 : 0);
    }
  };

  // Helper function to calculate duration-based discount
  const calculateDurationDiscount = (days: number, total: number): { discountAmount: number, discountPercent: number } => {
    let discountPercent = 0;
    
    if (days >= 30) {
      discountPercent = 3;
    } else if (days >= 14) {
      discountPercent = 2.5;
    } else if (days >= 7) {
      discountPercent = 2;
    }
    
    const discountAmount = Math.round((total * discountPercent / 100) * 100) / 100; // Round to 2 decimal places
    return { discountAmount, discountPercent };
  };

  // Update surcharge and discount in real-time when times/dates change
  useEffect(() => {
    setSurcharge(calculateTimeSurcharge());
    
    // Calculate discount for car rentals only
    if (!isTransfer && pickupDate && returnDate && formData.vehicle) {
      const days = Math.ceil((returnDate.getTime() - pickupDate.getTime()) / (1000 * 60 * 60 * 24));
      const selectedCar = cars.find(c => c.name === formData.vehicle);
      
      if (selectedCar) {
        let baseTotal = selectedCar.pricePerDay * days;
        
        // Add delivery fee
        if (formData.pickupLocation === 'hotel' || formData.pickupLocation === 'custom') {
          baseTotal += 20;
        }
        
        // Add surcharge
        const timeSurcharge = calculateTimeSurcharge();
        const totalWithSurcharge = baseTotal + timeSurcharge;
        
        // Calculate discount
        const { discountAmount, discountPercent } = calculateDurationDiscount(days, totalWithSurcharge);
        setDiscount(discountAmount);
        setDiscountPercent(discountPercent);
      }
    } else {
      setDiscount(0);
      setDiscountPercent(0);
    }
  }, [pickupTime, returnTime, isTransfer, pickupDate, returnDate, formData.vehicle, formData.pickupLocation]);

  const calculateTotal = () => {
    if (!formData.vehicle || !pickupDate) return 0;
    
    let baseTotal = 0;
    
    if (isTransfer) {
      const selectedTransfer = transfers.find(t => t.name === formData.vehicle);
      baseTotal = selectedTransfer ? selectedTransfer.pricePerKm * 50 : 0; // Assuming average 50km trip
      
      // Add time-based surcharge
      const timeSurcharge = calculateTimeSurcharge();
      return baseTotal + timeSurcharge;
    } else {
      const selectedCar = cars.find(c => c.name === formData.vehicle);
      if (!selectedCar || !returnDate) return 0;
      
      const days = Math.ceil((returnDate.getTime() - pickupDate.getTime()) / (1000 * 60 * 60 * 24));
      baseTotal = selectedCar.pricePerDay * days;
      
      // Add delivery fee for car rentals
      if (formData.pickupLocation === 'hotel' || formData.pickupLocation === 'custom') {
        baseTotal += 20;
      }
      
      // Add time-based surcharge
      const timeSurcharge = calculateTimeSurcharge();
      const totalWithSurcharge = baseTotal + timeSurcharge;
      
      // Apply duration discount
      const { discountAmount } = calculateDurationDiscount(days, totalWithSurcharge);
      return totalWithSurcharge - discountAmount;
    }
  };

  // Helper function to extract UTM parameters
  const getUtmParams = () => {
    const utmParams: Record<string, string> = {};
    const urlParams = new URLSearchParams(window.location.search);
    
    for (const [key, value] of urlParams.entries()) {
      if (key.startsWith('utm_')) {
        utmParams[key] = value;
      }
    }
    
    return Object.keys(utmParams).length > 0 ? utmParams : undefined;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!pickupDate || (!isTransfer && !returnDate)) {
      toast({
        title: "Date selection required",
        description: isTransfer ? "Please select pickup date." : "Please select both pickup and return dates.",
        variant: "destructive"
      });
      return;
    }

    if (!pickupTime || (!isTransfer && returnDate && !returnTime)) {
      toast({
        title: "Time selection required",
        description: isTransfer ? "Please select pickup time." : "Please select both pickup and return times.",
        variant: "destructive"
      });
      return;
    }
    
    setIsSubmitting(true);
    
    try {
      // Helper function to combine date and time into ISO string
      const combineDateTime = (date: Date, time: string): string => {
        const [hours, minutes] = time.split(':');
        const combined = new Date(date);
        combined.setHours(parseInt(hours), parseInt(minutes), 0, 0);
        return combined.toISOString();
      };

      // Create combined datetime strings
      const pickupDateTime = combineDateTime(pickupDate, pickupTime);
      const returnDateTime = returnDate && returnTime ? combineDateTime(returnDate, returnTime) : pickupDateTime;
      
      // Calculate duration for rentals
      const durationDays = !isTransfer && returnDate 
        ? Math.ceil((new Date(returnDateTime).getTime() - new Date(pickupDateTime).getTime()) / (1000 * 60 * 60 * 24))
        : 1;

      // Calculate base rates and pricing breakdown
      const getVehicleBaseRate = () => {
        if (isTransfer) {
          const selectedTransfer = transfers.find(t => t.name === formData.vehicle);
          return selectedTransfer ? selectedTransfer.pricePerKm * 50 : 0; // 50km average
        } else {
          const selectedCar = cars.find(c => c.name === formData.vehicle);
          return selectedCar ? selectedCar.pricePerDay : 0;
        }
      };

      const baseRate = getVehicleBaseRate();
      const deliveryFee = (!isTransfer && (formData.pickupLocation === 'hotel' || formData.pickupLocation === 'custom')) ? 20 : 0;
      const baseTotal = isTransfer ? baseRate : (baseRate * durationDays) + deliveryFee;
      
      // Prepare reservation data
      const reservationData = {
        // Date/time fields in ISO format
        pickupDate: pickupDateTime,
        returnDate: returnDateTime,
        
        // Formatted date/time strings for easy reading
        pickupDateFormatted: format(pickupDate, "yyyy-MM-dd"),
        returnDateFormatted: returnDate ? format(returnDate, "yyyy-MM-dd") : format(pickupDate, "yyyy-MM-dd"),
        pickupTime: pickupTime, // HH:mm format
        returnTime: returnTime, // HH:mm format
        
        vehicle: formData.vehicle,
        pickupLocation: formData.pickupLocation,
        firstName: formData.firstName,
        lastName: formData.lastName,
        email: formData.email,
        phone: formData.phone,
        specialRequests: formData.specialRequests || '',
        ...(formData.deliveryAddress && { deliveryAddress: formData.deliveryAddress }),
        ...(formData.dropOffLocation && { dropOffLocation: formData.dropOffLocation }),
        
        // Detailed pricing breakdown
        pricing: {
          dailyRate: baseRate,
          days: durationDays,
          surcharge: surcharge,
          deliveryFee: deliveryFee,
          baseTotal: baseTotal,
          discount: discount,
          discountPercent: discountPercent,
          total: calculateTotal()
        },
        
        summary: {
          vehicle: formData.vehicle,
          period: isTransfer 
            ? `${format(pickupDate, "PPP")} at ${pickupTime}`
            : returnDate 
              ? `${format(pickupDate, "PPP")} at ${pickupTime} - ${format(returnDate, "PPP")} at ${returnTime}`
              : `${format(pickupDate, "PPP")} at ${pickupTime}`,
          durationDays,
          totalAmount: calculateTotal(),
          currency: 'EUR'
        },
        metadata: {
          reservationId: uuidv4(),
          timestamp: new Date().toISOString(),
          pageUrl: window.location.href,
          referrer: document.referrer || '',
          userAgent: navigator.userAgent,
          utmParams: getUtmParams()
        }
      };

      // Submit to Make.com webhook directly
      const response = await fetch('https://hook.eu2.make.com/8usev71f3ghg1hr1kjtledtpbnhwfe5r', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(reservationData),
      });

      if (response.ok) {
        toast({
          title: "✅ Reservation request sent",
          description: "We'll confirm your booking shortly.",
        });
        
        // Reset form on success
        setFormData({
          firstName: '',
          lastName: '',
          email: '',
          phone: '',
          vehicle: '',
          pickupLocation: 'airport',
          dropOffLocation: '',
          deliveryAddress: '',
          specialRequests: ''
        });
        setPickupDate(undefined);
        setReturnDate(undefined);
        setPickupTime("10:00");
        setReturnTime("18:00");
      } else {
        toast({
          title: "⚠️ Something went wrong",
          description: "Please try again or contact support.",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error('Reservation submission error:', error);
      toast({
        title: "⚠️ Something went wrong",
        description: "Please try again or contact support.",
        variant: "destructive"
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen">
      <Navbar />
      <div className="pt-24 pb-16 bg-primary-navy text-white">
        <div className="container mx-auto px-4 text-center">
          <h1 className="text-4xl md:text-5xl font-bold mb-4">
            {isTransfer ? 'Book Your Transfer' : 'Book Your Prestige Ride'}
          </h1>
          <p className="text-lg max-w-3xl mx-auto">
            {isTransfer ? 'Complete the form below to book your transfer service' : 'Complete the form below to reserve your luxury vehicle'}
          </p>
        </div>
      </div>

      <section className="py-16">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto bg-white rounded-lg shadow-lg p-8">
            <form onSubmit={handleSubmit}>
              <div className="mb-8">
                <h2 className="text-2xl font-bold text-primary-navy mb-4">
                  {isTransfer ? 'Transfer Details' : 'Rental Details'}
                </h2>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        {isTransfer ? 'Service Date' : 'Pick-up Date'}
                      </label>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            className="w-full justify-start text-left font-normal"
                          >
                            {pickupDate ? (
                              format(pickupDate, "PPP")
                            ) : (
                              <span>Select date</span>
                            )}
                            <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={pickupDate}
                            onSelect={setPickupDate}
                            initialFocus
                            className={cn("p-3 pointer-events-auto")}
                            disabled={(date) => date < new Date()}
                          />
                        </PopoverContent>
                      </Popover>
                    </div>

                    {!isTransfer && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          {isTransfer ? 'Service Time' : 'Pick-up Time'}
                        </label>
                        <Input
                          id="pickupTime"
                          name="pickupTime"
                          type="time"
                          value={pickupTime}
                          onChange={(e) => setPickupTime(e.target.value)}
                          className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-gold"
                          required={!!pickupDate}
                        />
                      </div>
                    )}
                  </div>

                  {!isTransfer && (
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Return Date</label>
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button
                              variant="outline"
                              className="w-full justify-start text-left font-normal"
                            >
                              {returnDate ? (
                                format(returnDate, "PPP")
                              ) : (
                                <span>Select date</span>
                              )}
                              <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <Calendar
                              mode="single"
                              selected={returnDate}
                              onSelect={setReturnDate}
                              initialFocus
                              className={cn("p-3 pointer-events-auto")}
                              disabled={(date) => date < new Date() || (pickupDate && date < pickupDate)}
                            />
                          </PopoverContent>
                        </Popover>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Return Time</label>
                        <Input
                          id="returnTime"
                          name="returnTime"
                          type="time"
                          value={returnTime}
                          onChange={(e) => setReturnTime(e.target.value)}
                          className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-gold"
                          required={!!returnDate}
                        />
                      </div>
                    </div>
                  )}

                  {isTransfer && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Service Time</label>
                      <Input
                        id="pickupTime"
                        name="pickupTime"
                        type="time"
                        value={pickupTime}
                        onChange={(e) => setPickupTime(e.target.value)}
                        className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-gold"
                        required={!!pickupDate}
                      />
                    </div>
                  )}

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Vehicle Selection</label>
                    <select 
                      id="vehicle"
                      name="vehicle"
                      value={formData.vehicle}
                      onChange={handleChange}
                      className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-gold"
                      required
                    >
                      <option value="">Select a vehicle</option>
                      {isTransfer 
                        ? transfers.map((transfer) => (
                            <option key={transfer.id} value={transfer.name}>
                              {transfer.name} - €{transfer.pricePerKm}/km
                            </option>
                          ))
                        : cars.map((car) => (
                            <option key={car.id} value={car.name}>
                              {car.name} - €{car.pricePerDay}/day
                            </option>
                          ))
                      }
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {isTransfer ? 'Pick-up Location' : 'Pick-up Location'}
                    </label>
                    <select 
                      id="pickupLocation"
                      name="pickupLocation"
                      value={formData.pickupLocation}
                      onChange={handleChange}
                      className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-gold"
                      required
                    >
                      {isTransfer ? (
                        <>
                          <option value="sofia-airport">Sofia Airport</option>
                          <option value="varna-airport">Varna Airport</option>
                          <option value="custom">Custom Location</option>
                        </>
                      ) : (
                        <>
                          <option value="airport">Sofia Airport</option>
                          <option value="office">LuxRide Office</option>
                          <option value="hotel">Hotel Delivery (+€20)</option>
                          <option value="custom">Custom Location (+€20)</option>
                        </>
                      )}
                    </select>
                  </div>

                  {((formData.pickupLocation === 'hotel' || formData.pickupLocation === 'custom') && !isTransfer) && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Delivery Address (Sofia or Varna only)
                      </label>
                      <Input
                        id="deliveryAddress"
                        name="deliveryAddress"
                        value={formData.deliveryAddress || ''}
                        onChange={handleChange}
                        placeholder="Enter address in Sofia or Varna"
                        required
                      />
                      <p className="text-sm text-gray-500 mt-1">
                        Additional €20 delivery fee applies. Service available only in Sofia and Varna.
                      </p>
                    </div>
                  )}

                  {(formData.pickupLocation === 'custom' && isTransfer) && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Custom Pick-up Address
                      </label>
                      <Input
                        name="deliveryAddress"
                        value={formData.deliveryAddress || ''}
                        onChange={handleChange}
                        placeholder="Enter pick-up address"
                        required
                      />
                    </div>
                  )}

                  {isTransfer && (
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-1">Drop-off Location</label>
                      <Input
                        id="dropOffLocation"
                        name="dropOffLocation"
                        value={formData.dropOffLocation}
                        onChange={handleChange}
                        placeholder="Enter your destination address"
                        required
                      />
                    </div>
                  )}
                </div>
              </div>
              
              <div className="mb-8">
                <h2 className="text-2xl font-bold text-primary-navy mb-4">Contact Information</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">First Name</label>
                    <Input
                      id="firstName"
                      name="firstName"
                      value={formData.firstName}
                      onChange={handleChange}
                      required
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Last Name</label>
                    <Input
                      id="lastName"
                      name="lastName"
                      value={formData.lastName}
                      onChange={handleChange}
                      required
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                    <Input
                      id="email"
                      name="email"
                      type="email"
                      value={formData.email}
                      onChange={handleChange}
                      required
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                    <Input
                      id="phone"
                      name="phone"
                      type="tel"
                      value={formData.phone}
                      onChange={handleChange}
                      required
                    />
                  </div>
                </div>
              </div>
              
              <div className="mb-8">
                <label className="block text-sm font-medium text-gray-700 mb-1">Special Requests (Optional)</label>
                <Textarea
                  id="specialRequests"
                  name="specialRequests"
                  value={formData.specialRequests}
                  onChange={handleChange}
                  rows={4}
                />
              </div>

              {formData.vehicle && pickupDate && (
                <div className="mb-8 p-6 bg-gray-50 rounded-lg">
                  <h3 className="text-xl font-bold text-primary-navy mb-4">Booking Summary</h3>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span>Vehicle:</span>
                      <span className="font-medium" data-summary-vehicle={formData.vehicle}>{formData.vehicle}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>{isTransfer ? 'Service Date:' : 'Rental Period:'}</span>
                      <span 
                        className="font-medium" 
                        data-summary-period={
                          isTransfer 
                            ? `${format(pickupDate, "PPP")} at ${pickupTime}`
                            : returnDate 
                              ? `${format(pickupDate, "PPP")} at ${pickupTime} - ${format(returnDate, "PPP")} at ${returnTime}`
                              : `${format(pickupDate, "PPP")} at ${pickupTime}`
                        }
                      >
                        {isTransfer 
                          ? `${format(pickupDate, "PPP")} at ${pickupTime}`
                          : returnDate 
                            ? `${format(pickupDate, "PPP")} at ${pickupTime} - ${format(returnDate, "PPP")} at ${returnTime}`
                            : `${format(pickupDate, "PPP")} at ${pickupTime}`
                        }
                      </span>
                    </div>
                    {!isTransfer && returnDate && (
                      <div className="flex justify-between">
                        <span>Duration:</span>
                        <span 
                          className="font-medium"
                          data-summary-duration-days={Math.ceil((returnDate.getTime() - pickupDate.getTime()) / (1000 * 60 * 60 * 24))}
                        >
                          {Math.ceil((returnDate.getTime() - pickupDate.getTime()) / (1000 * 60 * 60 * 24))} days
                        </span>
                      </div>
                    )}
                    {isTransfer && (
                      <div className="flex justify-between">
                        <span>Estimated Distance:</span>
                        <span className="font-medium">50 km (average)</span>
                      </div>
                    )}
                     <div className="flex justify-between">
                       <span>Early/Late hours surcharge:</span>
                       <span className="font-medium" data-summary-surcharge={surcharge}>€{surcharge}</span>
                     </div>
                     {!isTransfer && discount > 0 && (
                       <div className="flex justify-between text-green-600">
                         <span>Discount:</span>
                         <span className="font-medium" data-summary-discount={discount}>-€{discount}</span>
                       </div>
                     )}
                     <hr className="my-2" />
                     <div className="flex justify-between text-lg font-bold text-primary-navy">
                       <span>Total:</span>
                       <span data-summary-total-amount={calculateTotal()} data-summary-currency="EUR">€{calculateTotal()}</span>
                     </div>
                  </div>
                </div>
              )}
              
              <Button
                type="submit"
                className="bg-primary-gold hover:bg-yellow-600 text-white w-full py-6 text-lg font-medium"
                disabled={isSubmitting}
              >
                {isSubmitting ? 'Processing...' : (isTransfer ? 'Book Transfer Now' : 'Reserve Your Vehicle Now')}
              </Button>
            </form>
          </div>
        </div>
      </section>
      
      <Footer />
    </div>
  );
};

export default Booking;
