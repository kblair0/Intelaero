import BatteryCalculator from "./components/BatteryCalculator";
import Image from "next/image";

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col bg-white">
      {/* Logo Section */}
      <div className="flex flex-col justify-center items-center gap-5 mt-[calc(25vh-20px)] mb-10">
        <Image
          src="/Logonobackgrnd.png"
          alt="Intel Aero Logo"
          width={160}
          height={160}
          className="max-w-full h-auto"
          />
        <Image
          src="/Namenobackgrnd.png"
          alt="Intel Aero Title"
          width={400}
          height={80}
          className="max-w-full h-auto"
        />
      </div>

      {/* Title Section */}
      <div className="flex flex-col justify-center items-center gap-5 mt-10 md:mt-20 mb-10 lg:mb-20 xl:mb-20">
      <h2 className="text-2xl sm:text-3xl md:text-4xl font-normal text-black text-center">
        Intelligent Mission Assurance For RPAS
        </h2>
        <p className="text-2xl sm:text-3xl md:text-4xl font-normal text-black text-center">
          Smarter Planning, Safer Flights, Guaranteed Returns
        </p>
      </div>

      {/* Map Section */}
      <div className="flex flex-col justify-center items-center bg-gray-200 p-5 gap-5">
        <h1 className="text-4xl font-normal text-black text-center mb-4">
          Flight Assurance Demo
        </h1>
        {/* <Map /> */}
        <BatteryCalculator/>
      </div>
    </div>
  );
}
