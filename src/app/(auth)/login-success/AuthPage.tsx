'use client';

import { useEffect } from "react";
import { CheckCircleOutlined } from '@ant-design/icons';
import { useRouter } from 'next/navigation';

export default function AuthPage() {
  const router = useRouter();

  useEffect(() => {
    const timer = setTimeout(() => {
      router.push("/");
    }, 2000); 

    return () => clearTimeout(timer);
  }, [router]);

  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-blue-500 to-indigo-600">
      <div className="bg-white rounded-2xl shadow-lg p-10 text-center animate-fade-in">
        <CheckCircleOutlined style={{ fontSize: '64px', color: '#52c41a' }} />
        <h1 className="text-2xl font-semibold mt-4">Авторизация успешна</h1>
        <p className="text-gray-600 mt-2">Вы будете перенаправлены на главную страницу...</p>
      </div>
    </div>
  );
}