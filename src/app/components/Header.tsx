'use client'

import { useRouter } from "next/navigation";
import Cookies from "js-cookie";
export function Header() {
  const router = useRouter();

  const handleLogout = () => {
    Cookies.remove('access_token');
    Cookies.remove('refresh_token');
    router.push('/');
  }

  return (
    <div className="bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center">
          <div className="flex items-center gap-4">
            {/* <span className="text-sm text-gray-600">admin@example.com</span> */}
            <button onClick={handleLogout} className="text-sm text-gray-600 hover:text-gray-900">Выйти</button>
          </div>
        </div>
  );
}