import { createContext, useState, useRef } from "react";

export const AllData = createContext();

export function AllDataProvider({ children }) {
  const [pdfFile, setPdfFile] = useState(null);
  const [image, setImage] = useState(null);
  const [foucs, setFoucs] = useState(false);

  return (
    <AllData.Provider
      value={{ foucs, setFoucs, pdfFile, setPdfFile, image, setImage }}
    >
      {children}
    </AllData.Provider>
  );
}
