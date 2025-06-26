import logo from "./logo.svg";
import { Route, Routes } from "react-router-dom";
import MainPage from "./pages/MainPage";
import EditPage from "./pages/EditPage";
import { AllDataProvider } from "./context/Context";
import SendPage from "./pages/SendPage";
import EditTemplatePage from "./pages/EditTemplatePage";
import "./App.css";

import LoginPage from "./pages/LoginPage";

function App() {
  return (
    <AllDataProvider>
      <div className="App">
        <Routes>
          <Route path="/" element={<LoginPage />} />
          <Route path="/home" element={<MainPage />} />
          <Route path="/editpage" element={<EditPage />} />
          <Route path="/sendpage/:IdParams" element={<SendPage />} />
          <Route path="/edittem/:id" element={<EditTemplatePage />} />
        </Routes>
      </div>
    </AllDataProvider>
  );
}

export default App;
