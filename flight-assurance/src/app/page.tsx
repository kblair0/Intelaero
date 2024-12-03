import Map from "./components/Map";

export default function Home() {
  return (
    <div>
      <div className="flex justify-center items-center pt-4">
        <h1 className="text-center text-5xl font-bold text-gradient bg-clip-text text-transparent bg-gradient-to-r from-green-400 to-red-500 shadow-lg">
          Flight Assurance
        </h1>
      </div>
      <Map />
    </div>
  );
}
