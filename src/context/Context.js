import { createContext, useState, useRef } from "react";

export const AllData = createContext();

export function AllDataProvider({ children }) {
  const [pdfFile, setPdfFile] = useState(null);
  const [image, setImage] = useState(null);
  const [foucs, setFoucs] = useState(false);

  const [dimations, setDimations] = useState({
    viewportWidth: "",
    viewportHeight: "",
  });

  const formData = new FormData();

  return (
    <AllData.Provider
      value={{
        foucs,
        setFoucs,
        pdfFile,
        setPdfFile,
        image,
        setImage,
        formData,
        dimations,
        setDimations,
      }}
    >
      {children}
    </AllData.Provider>
  );
}