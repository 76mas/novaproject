import React, { useContext, useState, useRef, useEffect } from "react";
import { Stage, Layer, Image as KImage, Rect, Transformer } from "react-konva";
import { SearchCheck } from "lucide-react";

import useImage from "use-image";
import { AllData } from "../context/Context";
import "../css/edit.css";
import FieldSidebar from "./FieldSidebar";
import axios from "axios";
import { useNavigate } from "react-router-dom";

export default function EditPage() {

  const [loading, setLoading] = useState(false);

  const navigate = useNavigate();
  const { image, pdfFile, foucs, formData , dimations } = useContext(AllData); // صورة الـ PDF من Context

  const [img] = useImage(image); // الصورة المعروضة في Konva
  const [fields, setFields] = useState([]); // الحقول المرسومة
  const [selectedId, setSelectedId] = useState(null); // الحقل المحدد

  const stageRef = useRef();
  const trRef = useRef();

  const updateField = (updatedField) => {
    setFields((prev) =>
      prev.map((f) => (f.id === updatedField.id ? updatedField : f))
    );
  };

  const addField = (e) => {
    const pos = e.target.getStage().getPointerPosition();
    const newField = {
      id: crypto.randomUUID(),
      x: pos.x,
      y: pos.y,
      width: 150,
      height: 40,
      name: "حقل جديد",
      fill: "rgba(0, 123, 255, 0.3)",
      stroke: "#007bff",
      strokeWidth: 2,
    };
    setFields([...fields, newField]);
  };

  const selectedField = fields.find((f) => f.id === selectedId);

  useEffect(() => {
    if (selectedId && trRef.current && stageRef.current) {
      const selectedNode = stageRef.current.findOne(`#${selectedId}`);
      if (selectedNode) {
        trRef.current.nodes([selectedNode]);
        trRef.current.getLayer().batchDraw();
      }
    } else if (trRef.current) {
      trRef.current.nodes([]);
      trRef.current.getLayer().batchDraw();
    }
  }, [selectedId, fields]);

const handleSave = async () => {
  if (!fields.length) {
    alert("لا توجد حقول للحفظ!");
    return;
  }
setLoading(true)
  const name = prompt("اكتب اسم القالب:");
  if (!name) return;

  const templateId = crypto.randomUUID();

  const template = {
    id: templateId,
    name,
    image,
    pages: [
      {
        fields,
        width: img ? 800 : 0,
        height: img ? 600 : 0,
      },
    ],
  };

  const prevTemplates = JSON.parse(localStorage.getItem("templates") || "[]");
  const updatedTemplates = [...prevTemplates, template];
  localStorage.setItem("templates", JSON.stringify(updatedTemplates));

  // ✅ أضف هذا السطر لحل الخطأ
  const formData = new FormData();

  formData.append("file", pdfFile);
  formData.append("name", name);
  formData.append("fields", JSON.stringify(fields));

  try {
    await axios.post("http://localhost:5000/upload", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    setLoading(false);
    alert("✅ تم رفع الملف والاسم بنجاح");
  } catch (error) {
    setLoading(false);
    // console.error("❌ فشل الرفع", error);
    // alert("فشل الرفع");
  }

  navigate(`/sendpage/${templateId}`);
};

  const deleteSelectedField = () => {
    if (!selectedId && foucs) return;
    if (foucs) return;

    setFields((prev) => prev.filter((f) => f.id !== selectedId));
    setSelectedId(null);

    if (trRef.current) {
      trRef.current.nodes([]);
      trRef.current.getLayer().batchDraw();
    }
  };

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Delete" && selectedId) {
        deleteSelectedField();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [selectedId, fields]);

  // const handleAutoDetect = async () => {
  //   if (!pdfFile) {
  //     alert("ماكو ملف PDF محدد");
  //     return;
  //   }

  //   const formData = new FormData();
  //   formData.append("forAutoDetect", pdfFile);

  //   try {
  //     const response = await axios.post("http://localhost:5000/upload", formData, {
  //       headers: { "Content-Type": "multipart/form-data" },
  //     });

  //     const detectedFields = response.data;

  //     const styledFields = detectedFields.map((f) => ({
  //       ...f,
  //       id: crypto.randomUUID(),
  //       fill: "rgba(0, 123, 255, 0.3)",
  //       stroke: "#007bff",
  //       strokeWidth: 2,
  //     }));

  //     setFields((prev) => [...prev, ...styledFields]);

  //     alert("✅ تم جلب الحقول التلقائية بنجاح!");
  //   } catch (error) {
  //     console.error("❌ فشل التحليل:", error);
  //     alert("فشل التحليل");
  //   }
  // };




const handleAutoDetect = async () => {
  if (!pdfFile) {
    alert("ماكو ملف PDF محدد");
    return;
  }
setLoading(true);
  const formData = new FormData();
  formData.append("forAutoDetect", pdfFile);
  formData.append("viewportdimations", JSON.stringify(dimations)); // أضفنا الأبعاد هنا

  try {
    const response = await axios.post("http://localhost:3002/api/auto_detect", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });

    const detectedFields = response.data.data; // هنا فرقنا

    const styledFields = detectedFields.map((item) => {
      const [x, y, width, height] = item.field_details;
      return {
        id: crypto.randomUUID(),
        x,
        y,
        width,
        height,
        name: item.label,
        fill: "rgba(0, 123, 255, 0.3)",
        stroke: "#007bff",
        strokeWidth: 2,
      };
    });

    setFields((prev) => [...prev, ...styledFields]);
setLoading(false);
    alert("✅ تم جلب الحقول التلقائية بنجاح!");
  } catch (error) {
    console.error("❌ فشل التحليل:", error);
    alert("فشل التحليل");
  }
};


// const testAutoFields = () => {
//   const rawFields = [
//     {
//       field_details: [43, 146, 203, 48, 0.6],
//       label: "محل ولادة الام*",
//     },
//     {
//       field_details: [395, 146, 245, 48, 0.6],
//       label: "جنسية الام الاصلية*",
//     },
//     {
//       field_details: [248, 109, 207, 39, 0.7],
//       label: "مكتب المعلومات",
//     },
//   ];

//   const styledFields = rawFields.map((item) => {
//     const [x, y, width, height] = item.field_details;
//     return {
//       id: crypto.randomUUID(),
//       x,
//       y,
//       width,
//       height,
//       name: item.label,
//       fill: "rgba(0, 123, 255, 0.3)",
//       stroke: "#007bff",
//       strokeWidth: 2,
//     };
//   });

//   setFields((prev) => [...prev, ...styledFields]);
// };



  return (
    <div className="workspace">
      <h1>Edit Page</h1>
      <p style={{ marginTop: 10 }}>
        اضغط مرتين على الخلفية لإضافة حقل جديد، وامسك المربع لتحريكه أو تغيير
        حجمه.
      </p>

      <div className="container-edit">

        {loading && (
        <div className="spinner-overlay">
          <div className="animated-spinner"></div>
          <p className="loading-text">جاري التحميل...</p>
        </div>
      )}


        <div className="box-edit">
          <button className="create-btn" onClick={handleAutoDetect}>
            <SearchCheck size={16} />
            Auto Detect Boxs
          </button>

          <FieldSidebar field={selectedField} onUpdate={updateField} />

          <button className="save-button" onClick={handleSave}>
            <span>💾</span>
            <span>حفظ وارسال القالب</span>
          </button>
        </div>

        <Stage
          width={img ? img.width : 800}
          height={img ? img.height : 600}
          onDblClick={addField}
          ref={stageRef}
          style={{ border: "1px solid #ccc", marginTop: 20 }}
        >
          <Layer>
            {img && <KImage image={img} />}
            {fields.map((field) => (
              <Rect
                key={field.id}
                id={field.id}
                x={field.x}
                y={field.y}
                width={field.width}
                height={field.height}
                fill={field.fill}
                stroke={field.id === selectedId ? "blue" : field.stroke}
                strokeWidth={field.strokeWidth}
                draggable
                onClick={() => setSelectedId(field.id)}
                onDragEnd={(e) =>
                  updateField({
                    ...field,
                    x: e.target.x(),
                    y: e.target.y(),
                  })
                }
                onTransformEnd={(e) => {
                  const node = e.target;
                  const scaleX = node.scaleX();
                  const scaleY = node.scaleY();

                  node.scaleX(1);
                  node.scaleY(1);

                  updateField({
                    ...field,
                    x: node.x(),
                    y: node.y(),
                    width: Math.max(5, node.width() * scaleX),
                    height: Math.max(5, node.height() * scaleY),
                  });
                }}
              />
            ))}
            <Transformer
              ref={trRef}
              rotateEnabled={false}
              boundBoxFunc={(oldBox, newBox) => {
                if (newBox.width < 5 || newBox.height < 5) {
                  return oldBox;
                }
                return newBox;
              }}
            />
          </Layer>
        </Stage>
      </div>
    </div>
  );
}
