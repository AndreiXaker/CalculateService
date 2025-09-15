import { ToastContainer } from "react-toastify";
import { Header } from "../components/Header";
import { Sidebar } from "../components/Sidebar";
import 'react-toastify/dist/ReactToastify.css'

type LayoutProps = {
  children: React.ReactNode;
};

const Layout = ({ children }: LayoutProps) => (
  <div className="h-screen flex flex-col">
    <div className="flex-shrink-0">
      <Header />
    </div>

    <div className="flex flex-1 overflow-hidden">
      <Sidebar />
      <main className="flex-1 overflow-auto p-6 bg-gray-50">
        {children}
        <ToastContainer position="top-right" autoClose={3000} />
      </main>
    </div>
  </div>
);

export default Layout;
