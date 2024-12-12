import BatteryCalculator from "./components/BatteryCalculator";
import Image from 'next/image';
import './/styles/pages.css';

export default function Home() {
    return (
        <div className="landing">
            <div>
              
                <div className="logos">
                    <Image
                        src="/Logonobackgrnd.png"
                        alt="Intel Aero Logo"
                        width={160}
                        height={80}
                    />
                    <Image
                        src="/Namenobackgrnd.png"
                        alt="Intel Aero Title"
                        width={400}
                        height={80}
                    />
                </div>
                <div className="title">
                <h2 className="text-4xl font-normal text-black text-center mb-4">
                      Intelligent Mission Assurance For RPAS
                  </h2>
                  <p className="text-2xl font-normal text-black text-center mb-4">
                      Smarter Planning, Safer Flights, Guaranteed Returns
                  </p>
                </div>
            </div>

            {/* Map */}
            <div className="map">
                <h1 className="text-4xl font-normal text-black text-center mb-4">
                    Flight Assurance Demo
                </h1>
              {/* <Map /> */}
              <BatteryCalculator />
            </div>
        </div>
    );
}