export function Sidebar() {
  return (
    <div className="w-44 h-screen bg-white shadow-sm border-r border-gray-200 relative">
      <div className="p-4 border-b border-gray-200">
        <h1 className="text-lg font-semibold text-gray-900">
          Сервисный
          <br />
          Калькулятор
        </h1>
      </div>

      <nav className="mt-4">
        <div className="bg-blue-500 text-white px-4 py-2 text-sm font-medium">
          Расчеты
        </div>
      </nav>

      <div className="absolute bottom-4 left-4">
        <button className="text-sm text-gray-600 hover:text-gray-900">
          Выйти
        </button>
      </div>
    </div>
  )
}
