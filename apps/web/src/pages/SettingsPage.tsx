import { useState } from "react";
import PageTitle from "../components/ui/PageTitle";

export default function SettingsPage() {
  const [theme, setTheme] = useState(
    () => localStorage.getItem("overdrive:theme") ?? "system",
  );
  function updateTheme(value: string) {
    setTheme(value);
    localStorage.setItem("overdrive:theme", value);
  }
  return (
    <div className="page-container">
      <PageTitle
        title="設定"
        subtitle="管理工作空間與介面偏好（目前為示範設定）。"
      />
      <div className="panel form-panel">
        <label htmlFor="theme">主題偏好</label>
        <select
          id="theme"
          value={theme}
          onChange={(e) => updateTheme(e.target.value)}
        >
          <option value="system">依系統設定</option>
          <option value="light">淺色</option>
          <option value="dark">深色</option>
        </select>
        <p className="notice">
          目前只保存偏好，尚未套用整站換色；後續可接入 Theme Provider。
        </p>
      </div>
    </div>
  );
}
