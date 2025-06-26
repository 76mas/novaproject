// import React, { useState } from "react";
import { useContext } from "react";
import { AllData } from "../context/Context";


export default function FieldSidebar({ field, onUpdate }) {

  const {foucs, setFoucs}=useContext(AllData);




  if (!field)
    return (
      <div className="empty-sidebar">
        <div className="icon">🎯</div>
        <h4>لا يوجد حقل محدد</h4>
        <p>انقر على أي حقل لتعديل خصائصه</p>
      </div>
    );
console.log(field,"this is filed")
  return (
    <div className="sidebar-contenor">
      <div className="field-group">
        <label htmlFor="fieldName">اسم الحقل:</label>
        <input
      
          id="fieldName"
          className="field-input"
          value={field.name}
          onFocus={()=>{
            setFoucs(true);
          }}
          onBlur={()=>{
          
              setFoucs(false);
           
          }}
          
          onChange={(e) => onUpdate({ ...field, name: e.target.value })}
        />
      </div>

      
      <div className="field-group">
        <label htmlFor="fieldType">نوع الحقل:</label>
        <select
          id="fieldType"
          className="field-select"
          value={field.type}
          onChange={(e) => onUpdate({ ...field, type: e.target.value })}
        >
          <option value="text">نص</option>
          <option value="date">تاريخ</option>
          <option value="checkbox">مربع اختيار</option>
          <option value="number">رقم</option>
          <option value="email">بريد إلكتروني</option>
        </select>

        
      </div>
      <div className="field-group">
        <label>معلومات الحقل:</label>
        <div style={{ background: "#f8f9fa", padding: 10, borderRadius: 8, fontSize: "0.9rem" }}>
          <div>
            الموضع: {Math.round(field.x)}, {Math.round(field.y)}
          </div>
          <div>
            الحجم: {Math.round(field.width)} × {Math.round(field.height)}
          </div>
        </div>
      </div>
    </div>
  );

  
}
