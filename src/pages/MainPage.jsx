import { Trash2, FileText, Edit, MoreHorizontal, Plus, User,Brain, Download ,SearchCheck  } from "lucide-react";
import { pdfToImage } from "../services/pdfService";
import { useState, useContext, useRef } from "react";
import { useNavigate } from "react-router-dom";
import Swal from 'sweetalert2';
import { AllData } from "../context/Context";
import "../css/header.css";
import "../css/carddesign.css";
import axios from "axios";

export default function MainPage() {
  
const [loading, setLoading] = useState(false);
  
  const navigate = useNavigate();
  const { pdfFile, setPdfFile, image, setImage } = useContext(AllData);
  const { dimations, setDimations } = useContext(AllData);


  const fileInputRef = useRef(null);
   const fileInputRefExle = useRef(null);
   const fileInputRefAuto = useRef(null);

  // جلب القوالب من localStorage في البداية فقط
  const [localTemplates, setLocalTemplates] = useState(() => {
    const data = localStorage.getItem("templates");
    return data ? JSON.parse(data) : [];
  });

  const [activeMenuId, setActiveMenuId] = useState(null);

  const handleCreateNew = () => {
    fileInputRef.current.click();
  };

   const handleAutoDetectPage = () => {
    fileInputRefAuto.current.click();
  };

  const handleCreateExleFile=()=>{
     fileInputRefExle.current.click();
  }



const handleFileExle = async (event) => {
  const file = event.target.files[0];
  if (!file) return;
  setLoading(true);

  const formData = new FormData();
  formData.append("forExle", file);

  try {
    const response = await axios.post("http://localhost:3002/api/image_to_excel", formData, {
      headers: { "Content-Type": "multipart/form-data" },
      responseType: "blob", // Important to receive file as Blob
    });

    // Check if response is actually a blob (file)
    if (response.data instanceof Blob) {
      // Create download link for the file
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", "form_data.xlsx"); // Use safe filename
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url); // Clean up
  setLoading(false);
      alert("✅ تم رفع الملف وتحميل النتيجة");
    } else {
      console.error("Response is not a file blob:", response.data);
      alert("❌ خطأ في تنسيق الاستجابة");
    }
  } catch (error) {
    console.error("❌ فشل الرفع", error);
    
    // Try to extract error message from response
    if (error.response && error.response.data) {
      try {
        const errorText = await error.response.data.text();
        const errorObj = JSON.parse(errorText);
        alert(`فشل الرفع: ${errorObj.error || errorObj.details || 'خطأ غير معروف'}`);
      } catch (parseError) {
        alert("فشل الرفع");
      }
    } else {
      alert("فشل الرفع");
    }
  }
};

const handleFileAuto = async (event) => {
  const file = event.target.files[0];
  if (!file) return;

  const imageUrl = URL.createObjectURL(file); // ← هذا رابط الصورة

  const formData = new FormData();
  formData.append("forAutoDetect", file);

  try {
    const response = await axios.post("http://localhost:5000/upload", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });

    const fields = response.data; // ← الباك يرجع فقط المصفوفة

    // خزن الصورة والحقول
    localStorage.setItem("auto_detect_img", imageUrl);
    localStorage.setItem("auto_detect_fields", JSON.stringify(fields));

    navigate("/autodetect");
  } catch (error) {
    console.error("فشل التحليل:", error);
    alert("فشل التحليل");
  }
};








  const handleFileChange = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    setPdfFile(file);
    const arrayBuffer = await file.arrayBuffer();
    const img = await pdfToImage(arrayBuffer,setDimations);
    setImage(img);

    navigate("/editpage");
  };

  const handleDelete = (template) => {
    Swal.fire({
      title: "هل أنت متأكد؟",
      text: `راح تحذف "${template.name}"`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "نعم، احذف",
      cancelButtonText: "إلغاء",
    }).then((result) => {
      if (result.isConfirmed) {
        const filtered = localTemplates.filter((t) => t.id !== template.id);
        setLocalTemplates(filtered);
        localStorage.setItem("templates", JSON.stringify(filtered));
        Swal.fire("تم الحذف!", `تم حذف "${template.name}".`, "success");
      }
    });
  };

  const handleRename = (template) => {
    const newName = prompt("Enter new name:", template.name);
    if (newName) {
      // تحديث الاسم في localStorage
      const updatedTemplates = localTemplates.map((t) =>
        t.id === template.id ? { ...t, name: newName } : t
      );
      setLocalTemplates(updatedTemplates);
      localStorage.setItem("templates", JSON.stringify(updatedTemplates));
      alert(`Renamed to: ${newName}`);
    }
  };



const handleEdit = (template) => {
  // alert(`Editing template: ${template.name}`);
  localStorage.setItem("editingTemplate", JSON.stringify(template));
  navigate(`/edittem/${template.id}`);
};


  return (
    <>
      <header className="header">
        <div className="header-content">
          <div className="logo-section">
            <div className="brand-name"  style={{color:"#3730a3"}} >NOVA DEVSPRINT</div>
            <div className="project-name"  style={{color:"#3730a3"}} >Document Generator</div>
          </div>

          <div className="header-actions">   
             <button className="create-btn" onClick={handleCreateExleFile}>
              <Brain  size={16} />
              EXCEL-NATOR
            </button>

            <button className="create-btn" onClick={handleCreateNew}>
              <Plus size={16} />
              Create New
            </button>


          
            <input
              type="file"
              ref={fileInputRef}
              style={{ display: "none" }}
              onChange={handleFileChange}
            />
              <input
              type="file"
              ref={fileInputRefExle}
              style={{ display: "none" }}
              onChange={handleFileExle}
            />
           

            <div className="user-menu-container">
              <button className="user-btn">
                <User size={18} />
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="continer">

      {loading && (
        <div className="spinner-overlay">
          <div className="animated-spinner"></div>
          <p className="loading-text">جاري التحميل...</p>
        </div>
      )}
        <div className="templates-grid">
          {localTemplates.length === 0 ? (
            <p className="emptystat" style={{ padding: "20px", textAlign: "center" }}>
              لا توجد قوالب محفوظة حاليًا.
            </p>
          ) : (
            localTemplates.map((template) => (
              <div key={template.id} className="template-card" style={{ textAlign: "right" }}>
                <div className="template-type"></div>

                <div className="template-preview">
                  <div className="document-mockup">
                    <img src={template.image} alt="preview" style={{ height: "100px" }} />
                  </div>
                </div>

                <div className="template-info">
                  <h3 className="template-name">{template.name}</h3>

                  <div className="template-actions">
                    <button className="use-btn" onClick={() => navigate(`/sendpage/${template.id}`)}>
                      Use Template
                    </button>

                    <div className="menu-container">
                      <button
                        className="menu-btn"
                        onClick={() =>
                          setActiveMenuId(activeMenuId === template.id ? null : template.id)
                        }
                      >
                        <MoreHorizontal size={16} />
                      </button>

                      {activeMenuId === template.id && (
                    
                             <div className="action-menu">
                              <button className="action-item" onClick={() => {
                                handleEdit(template);
                                setActiveMenuId(false);
                              }}>
                                <Edit size={14} />
                                Edit
                              </button>
                              <button className="action-item" onClick={() => {
                                handleRename(template);
                                setActiveMenuId(false);
                              }}>
                                <FileText size={14} />
                                Rename
                              </button>
                              <button className="action-item delete" onClick={() => {
                                handleDelete(template);
                                setActiveMenuId(false);
                              }}>
                                <Trash2 size={14} />
                                Delete
                              </button>
                            </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </>
  );
}
