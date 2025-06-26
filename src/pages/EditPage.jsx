import React, { useContext, useState, useRef, useEffect } from "react";
import { Stage, Layer, Image as KImage, Rect, Transformer } from "react-konva";
import useImage from "use-image";
import { AllData } from "../context/Context";
import "../css/edit.css"
import FieldSidebar from "./FieldSidebar";
import axios from "axios";

import { saveTemplate } from "../services/saveTemplate";

import { useNavigate } from "react-router-dom";



export default function EditPage() {

    const navigate=useNavigate();
  const { image ,pdfFile,foucs,setFoucs} = useContext(AllData); // صورة الـ PDF من Context

  // تحويل base64 إلى صورة لعرضها في Konva
  const [img] = useImage(image);

  // الحقول التي سيضيفها المستخدم فوق الصورة
  const [fields, setFields] = useState([]);

  // id الحقل المحدد حالياً (للتعديل)
  const [selectedId, setSelectedId] = useState(null);

  const stageRef = useRef();
  const trRef = useRef();

  // تحديث الحقل بعد السحب أو تغيير الحجم
  const updateField = (updatedField) => {
    setFields((prev) =>
      prev.map((f) => (f.id === updatedField.id ? updatedField : f))
    );
  };

  // إضافة حقل جديد عند الضغط المزدوج على الخلفية
  const addField = (e) => {
    // إحداثيات الفأرة مقسومة على مقياس الصورة (هنا مقياس 1)
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
  // تحديث محدد Transformer لما يتغير selectedId
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

  const name = prompt("اكتب اسم القالب:");
  if (!name) return;

  const templateId = crypto.randomUUID(); // ← ID جديد للقالب

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

  // خزّن القالب الجديد ضمن مصفوفة
  const prevTemplates = JSON.parse(localStorage.getItem("templates") || "[]");
  const updatedTemplates = [...prevTemplates, template];
  localStorage.setItem("templates", JSON.stringify(updatedTemplates));

  await handleSubmit(name);
  alert("✅ تم حفظ القالب بنجاح");

  // ← الآن استخدم ID القالب للتنقل

  const formData = new FormData();
  formData.append("file", pdfFile); // الملف
  formData.append("name", name);         // الاسم
  formData.append("fields", JSON.stringify(fields));
console.log(formData);
   try {
    await axios.post("http://localhost:5000/upload", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });

    alert("✅ تم رفع الملف والاسم بنجاح");
  } catch (error) {
    console.error("❌ فشل الرفع", error);
    alert("فشل الرفع");
  }
  navigate(`/sendpage/${templateId}`);
};

const handleSubmit = async (name) => {

  console.log(name)

}



const deleteSelectedField = () => {
  console.log("foucs",foucs);
  if (!selectedId && foucs) return;
if (foucs) return;


  setFields((prev) => prev.filter((f) => f.id !== selectedId));
  setSelectedId(null);

  // إفراغ الـ Transformer بشكل صريح
  if (trRef.current) {
    trRef.current.nodes([]);
    trRef.current.getLayer().batchDraw();
  }
};

useEffect(() => {
  const handleKeyDown = (e) => {
    if ((e.key === "Delete") && selectedId) {
      deleteSelectedField();
    }
  };

  window.addEventListener("keydown", handleKeyDown);
  return () => {
    window.removeEventListener("keydown", handleKeyDown);
  };
}, [selectedId, fields]);

  return (
    <div className="workspace">

      <h1>Edit Page</h1>
    <p style={{ marginTop: 10 }}>
        اضغط مرتين على الخلفية لإضافة حقل جديد، وامسك المربع لتحريكه أو تغيير
        حجمه.
      </p>
<div className="container-edit">
   <div className='box-edit'>
        <FieldSidebar 
        field={selectedField} 
        onUpdate={updateField} 
         />
        <button className="save-button" onClick={handleSave}>
                <span>💾</span>
                <span >حفظ وارسال القالب</span>
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

                // إعادة تعيين القياس بعد التحويل لأن Konva تضرب الحجم بالـ scale
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
              // لا تسمح بحجم أصغر من 5px
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



