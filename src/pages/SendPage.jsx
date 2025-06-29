import "../css/send.css"
import { useState,useContext } from "react";
import axios from "axios";
import { useParams } from "react-router-dom";
import { AllData } from "../context/Context";


export default function SendPage() {
    const { pdfFile , dimations} = useContext(AllData); // صورة الـ PDF من Context
  
    const {IdParams}=useParams();

  const template = JSON.parse(localStorage.getItem("templates"))

  // استخراج الحقول من أول صفحة
  const [fields, setFields] = useState(template);


  const fildInfo = fields.find(field => field.id === IdParams);

// console.log(IdParams)
    console.log(fildInfo ,"kajsdfvhg")
    // console.log(fields)

  // تحديث قيمة حقل
const handleChange = (fieldId, newValue) => {
  setFields(prevFields =>
    prevFields.map(field => {
      if (field.id !== IdParams) return field;

      return {
        ...field,
        pages: field.pages.map((page, pageIndex) => ({
          ...page,
          fields: page.fields.map(f =>
            f.id === fieldId ? { ...f, value: newValue } : f
          )
        }))
      };
    })
  );
};


const handelFetch = async () => {
  const updatedInfo = fields.find(field => field.id === IdParams);

  const formData = new FormData();
  formData.append("valueofboxs", JSON.stringify(updatedInfo));
  formData.append("pdfFile", pdfFile);
  formData.append("viewportdimations", JSON.stringify(dimations));
  try {
    const response = await axios.post("http://localhost:3002/api/generate-pdf", formData, {
      headers: {
        "Content-Type": "multipart/form-data",
      },
      responseType: "blob", // <-- Important!
    });

    // Create a download link for the PDF
    const url = window.URL.createObjectURL(new Blob([response.data], { type: "application/pdf" }));
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", "stamped-file.pdf"); // Set the file name
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);

    console.log("✅ تم الإرسال بنجاح");
  } catch (error) {
    console.error("❌ فشل الإرسال:", error);
  }
};

  return (

    <div className="perant">
    <div className="form-page-container">
      <h2 className="form-title">املأ الحقول التالية:</h2>

      {fildInfo.pages[0].fields.map((field) => (
        <div key={field.id} className="form-field-group">
          <label className="form-label">{field.name}</label>
          <input
            className="form-input"
            type={field.type || "text"}
            value={field.value}
            onChange={(e) => handleChange(field.id, e.target.value)}
          />
        </div>
      ))}

      <button
        className="form-submit-btn"
        onClick={() => {
          handelFetch();
        
          // تقدر ترسلها للباك إند هنا
        }}
      >
        إرسال البيانات
      </button>
    </div>
    </div>
  );
}