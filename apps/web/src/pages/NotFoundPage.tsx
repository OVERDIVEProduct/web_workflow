import { Link } from "react-router";
import { ROUTES } from "../app/routes";
export default function NotFoundPage() {
  return (
    <div className="page-container">
      <h1>404｜找不到頁面</h1>
      <p>請檢查網址，或回到首頁。</p>
      <Link className="button-link" to={ROUTES.dashboard}>
        返回首頁
      </Link>
    </div>
  );
}
