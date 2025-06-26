import "../css/send.css"
import { useState } from "react";
import axios from "axios";
import { useParams } from "react-router-dom";


export default function SendPage() {
  
    const {IdParams}=useParams();

  const template = JSON.parse(localStorage.getItem("templates"))

  // استخراج الحقول من أول صفحة
  const [fields, setFields] = useState(template);


  const fildInfo = fields.find(field => field.id === IdParams);

// console.log(IdParams)
    console.log(fildInfo ,"kajsdfvhg")
    // console.log(fields)

  // تحديث قيمة حقل
  const handleChange = (id, newValue) => {
    setFields((prevFields) =>
      prevFields.map((field) =>
        field.id === id ? { ...field, value: newValue } : field
      )
    );
  };

const handelFetch = async () => {
  console.log(fildInfo , "new arry")
  try {
    const response = await axios.post("http://localhost:3000/api/submit", {
      valueofboxs: fildInfo,
    }, {
      headers: {
        "Content-Type": "application/json",
      },
    });

    console.log("تم الإرسال بنجاح:", response.data);
    // ممكن تخلي تنبيه أو تنقله لصفحة ثانية حسب الحاجة
  } catch (error) {
    console.error("فشل الإرسال:", error);
    // ممكن تعرض رسالة خطأ للمستخدم
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

