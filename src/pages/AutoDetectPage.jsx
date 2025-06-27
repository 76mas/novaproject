import React, { useState, useRef, useEffect } from "react";
import { Stage, Layer, Rect, Image as KImage, Transformer } from "react-konva";
import useImage from "use-image";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import "../css/edit.css";

export default function AutoDetectPage() {
  const [imgSrc, setImgSrc] = useState(null);
  const [fields, setFields] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const stageRef = useRef();
  const trRef = useRef();
  const navigate = useNavigate();

  const [img] = useImage(imgSrc);

  // تحميل البيانات من localStorage
  useEffect(() => {
    const img = localStorage.getItem("auto_detect_img");
    const fieldsData = JSON.parse(localStorage.getItem("auto_detect_fields") || "[]");

    if (img) setImgSrc(img);
    if (fieldsData.length) setFields(fieldsData);
  }, []);

  // تحديد الـ Transformer عند تحديد الحقل
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

  // إضافة حقل جديد يدويًا
  const onDblClick = (e) => {
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

  // تحديث بيانات الحقل
  const updateField = (updatedField) => {
    setFields((prev) =>
      prev.map((f) => (f.id === updatedField.id ? updatedField : f))
    );
  };

  // حذف الحقل المحدد
  const deleteSelectedField = () => {
    if (!selectedId) return;
    setFields((prev) => prev.filter((f) => f.id !== selectedId));
    setSelectedId(null);
    if (trRef.current) {
      trRef.current.nodes([]);
      trRef.current.getLayer().batchDraw();
    }
  };

  // حذف الحقل عند الضغط على Delete
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Delete" && selectedId) {
        deleteSelectedField();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedId]);

  // حفظ القالب وإرساله للباك إند
  const handleSave = async () => {
    if (!fields.length) {
      alert("لا توجد حقول للحفظ!");
      return;
    }

    const name = prompt("اكتب اسم القالب:");
    if (!name) return;

    const templateId = crypto.randomUUID();

    const template = {
      id: templateId,
      name,
      img: imgSrc,
      pages: [
        {
          fields,
          width: img ? img.width : 0,
          height: img ? img.height : 0,
        },
      ],
    };

    const prevTemplates = JSON.parse(localStorage.getItem("templates") || "[]");
    const updatedTemplates = [...prevTemplates, template];
    localStorage.setItem("templates", JSON.stringify(updatedTemplates));

    const formData = new FormData();
    formData.append("name", name);
    formData.append("fields", JSON.stringify(fields));

    try {
      await axios.post("http://localhost:5000/upload", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      alert("✅ تم رفع القالب بنجاح");
      navigate(`/sendpage/${templateId}`);
    } catch (error) {
      console.error("❌ فشل الرفع:", error);
      alert("فشل رفع القالب");
    }
  };

  return (
    <div className="workspace">
      <h1>تحليل القالب آليًا</h1>
      <p style={{ marginTop: 10 }}>
        اضغط مرتين على الخلفية لإضافة حقل جديد، وامسك المربع لتحريكه أو تغيير حجمه.
      </p>

      <div className="container-edit">
        <div className="box-edit">
          <button className="save-button" onClick={handleSave}>
            <span>💾</span>
            <span>حفظ وارسال القالب</span>
          </button>
        </div>

        {img && (
          <Stage
            width={img.width}
            height={img.height}
            ref={stageRef}
            onDblClick={onDblClick}
          >
            <Layer>
              <KImage image={img} />
              {fields.map((field) => (
                <Rect
                  key={field.id}
                  id={field.id}
                  x={field.x}
                  y={field.y}
                  width={field.width}
                  height={field.height}
                  fill={field.fill || "rgba(0, 123, 255, 0.3)"}
                  stroke={field.stroke || "#007bff"}
                  strokeWidth={field.strokeWidth || 2}
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
                  if (newBox.width < 5 || newBox.height < 5) return oldBox;
                  return newBox;
                }}
              />
            </Layer>
          </Stage>
        )}
      </div>
    </div>
  );
}
