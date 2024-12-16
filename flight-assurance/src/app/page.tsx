import BatteryCalculator from "./components/BatteryCalculator";
import Image from "next/image";

export default function Home() {
  return (
    <div className="h-screen flex flex-col bg-white">
      {/* Logo Section */}
      <div className="flex flex-col justify-center items-center gap-5 mt-[calc(25vh-20px)] mb-10">
        <Image
          src="/Logonobackgrnd.png"
          alt="Intel Aero Logo"
          width={160}
          height={160}
        />
        <Image
          src="/Namenobackgrnd.png"
          alt="Intel Aero Title"
          width={400}
          height={80}
        />
      </div>

      {/* Title Section */}
      <div className="flex flex-col justify-between items-center gap-5 mb-[250px]">
        <h2 className="text-4xl font-normal text-black text-center">
          Intelligent Mission Assurance For RPAS
        </h2>
        <p className="text-2xl font-normal text-black text-center">
          Smarter Planning, Safer Flights, Guaranteed Returns
        </p>
      </div>

      {/* Map Section */}
      <div className="flex flex-col justify-center items-center bg-[#ebeff5] p-5 gap-5">
        <h1 className="text-4xl font-normal text-black text-center mb-4">
          Flight Assurance Demo
        </h1>
        {/* <Map /> */}
        <BatteryCalculator/>
      </div>
    </div>
  );
}
