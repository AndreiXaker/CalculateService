"use client"

import Cookies from "js-cookie"
import { Button, Modal, Spin, message } from "antd"
import { useRouter } from "next/navigation"
import { useState, useEffect } from "react"
import dayjs from "dayjs"
import { acceptOrder, profile } from "../services/api/products"
import { ICalculation } from "../types/product.interface"
import { discount } from "../services/api/products"

export default function Service() {
  const [selectedStatus, setSelectedStatus] = useState("Все статусы")
  const [selectedSort, setSelectedSort] = useState("По дате создания")
  const [searchQuery, setSearchQuery] = useState("")
  const [loading, setLoading] = useState(false)
  const [calculations, setCalculations] = useState<ICalculation[]>([])
  const [nextUrl, setNextUrl] = useState<string | null>(null)
  const [prevUrl, setPrevUrl] = useState<string | null>(null)
  const [, setCurrentPageUrl] = useState<string | null>(null)
  const [, setUserRole] = useState<string | null>(null)
  const [isDiscountModalOpen, setIsDiscountModalOpen] = useState(false)
  const [discountComment, setDiscountComment] = useState("")
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null)
  const router = useRouter()

  const fetchData = async (url?: string) => {
    const token = Cookies.get('access_token')
    if (!token) return

    try {
      setLoading(true)
      const response = await profile(url) 
      const data = response.results

      setNextUrl(response.next)
      setPrevUrl(response.previous)
      setCurrentPageUrl(url || null)

      
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const uniqueCreators = new Set(data.map((item: any) => item.created_by))
      const role = uniqueCreators.size > 1 ? "manager" : "user"
      setUserRole(role)
      localStorage.setItem("userRole", role)

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const mapped: ICalculation[] = data.map((item: any) => ({
        id: item.id,
        name: item.name,
        customerName: item.customer_name,
        createdBy: item.created_by,
        createdAt: dayjs(item.created_at).format("DD.MM.YYYY"),
        status: item.status_display,
        statusColor: getStatusColor(item.status_display)
      }))

      setCalculations(mapped)
    } catch (err) {
      console.error("Ошибка при получении данных профиля:", err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])


  const handleClick = () => {
    setLoading(true)
    router.push("/main/new")
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "На утверждении":
        return "bg-yellow-500"
      case "Отклонен":
        return "bg-red-500"
      case "Создан":
        return "bg-green-500"
      case "Утвержден":
        return "bg-blue-500"
      case "Архив":
        return "bg-gray-600"
      default:
        return "bg-gray-400"
    }
  }

  const filteredCalculations = calculations
    .filter(calc =>
      calc.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      calc.customerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      calc.createdBy.toLowerCase().includes(searchQuery.toLowerCase())
    )
    .filter(calc =>
      selectedStatus === "Все статусы" || calc.status === selectedStatus
    )

  const sortedCalculations = [...filteredCalculations].sort((a, b) => {
    switch (selectedSort) {
      case "По названию":
        return a.name.localeCompare(b.name)
      case "По клиенту":
        return a.customerName.localeCompare(b.customerName)
      case "По дате создания":
        return dayjs(b.createdAt, "DD.MM.YYYY").valueOf() - dayjs(a.createdAt, "DD.MM.YYYY").valueOf()
      case "По ID":
        return b.id.localeCompare(a.id)
      default:
        return 0
    }
  })

const handleArchive = async (orderId: string) => {
  try {
    setLoading(true)
    await acceptOrder(orderId, "archived")
    message.success("Заказ успешно архивирован")
    fetchData() // обновляем список заказов
  } catch (error) {
    console.error("Ошибка при архивации заказа:", error)
    message.error("Не удалось архивировать заказ")
  } finally {
    setLoading(false)
  }
}

const handleAction = async (type: string, id: string) => {
  const selectedCalc = calculations.find(calc => calc.id === id)
  if (!selectedCalc) return

  if (type === "Просмотр") {
    router.push(`/orders/${id}`)
  } else if (type === "Редактировать") {
    const role = localStorage.getItem("userRole")

    if (role === "manager") {
      if (
        selectedCalc.status === "Утвержден" ||
        selectedCalc.status === "Отклонен"
      ) {
        return message.warning(
          "Менеджер может редактировать только заказы со статусами 'Создан', 'На утверждении' или 'На редактировании'"
        )
      }

      try {
        setLoading(true)
        await acceptOrder(id,'in_review')
        message.info("Открываем заказ для редактирования")
        router.push(`/orders/edit/${id}`)
      } catch (error) {
        console.error(error)
        message.error("Не удалось открыть заказ для редактирования")
      } finally {
        setLoading(false)
      }
    } else {
     
      if (selectedCalc.status !== "Создан") {
        return message.warning(
          "Пользователь может редактировать только заказы со статусом 'Создан'"
        )
      }
      router.push(`/orders/edit/${id}`)
    }
  } else {
    message.info(`Действие "${type}" пока не реализовано`)
  }
}

  const handleDiscountRequest = async (order: string, comment: string) => {
  try {
    setLoading(true)
    await discount(order, comment)
    message.success("Запрос на скидку отправлен")
    fetchData()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (error: any) {
    if (error.response) {
      const data = error.response.data

      if (Array.isArray(data)) {
        message.error(data.join(", "))
      } else if (typeof data === "object" && data !== null) {

        message.error(data.detail || JSON.stringify(data))
      } else {
        message.error(data || `Ошибка ${error.response.status}`)
      }
    } else if (error.request) {
      message.error("Нет ответа от сервера")
      console.error("Запрос без ответа:", error.request)
    } else {
      message.error("Ошибка при отправке запроса")
      console.error("Ошибка:", error.message)
    }
  } finally {
    setLoading(false)
  }
}
  return (
    <div className="p-4 sm:p-6 max-w-screen-xl mx-auto">
      <h2 className="text-xl sm:text-2xl font-semibold text-gray-900 mb-4">Расчеты</h2>

      <div className="flex justify-end mb-6">
        <Button type="primary" loading={loading} onClick={handleClick}>
          Создать новый расчет
        </Button>
      </div>

      {/* Фильтры */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-6">
        <div className="mb-3">
          <h3 className="text-sm font-medium text-gray-900 mb-1">Фильтры</h3>
          <p className="text-xs text-gray-500">Поиск и фильтрация расчетов</p>
        </div>

        <div className="flex flex-col md:flex-row gap-4">
          <input
            type="text"
            placeholder="Поиск по названию, клиенту или создателю"
            className="flex-1 px-3 py-2 border border-gray-300 rounded text-sm"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />

          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded text-sm"
          >
            <option>Все статусы</option>
            <option>Создан</option>
            <option>На утверждении</option>
            <option>Утвержден</option>
            <option>Отклонен</option>
            <option>Архив</option>
          </select>

          <select
            value={selectedSort}
            onChange={(e) => setSelectedSort(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded text-sm"
          >
            <option>По дате создания</option>
            <option>По названию</option>
            <option>По клиенту</option>
            <option>По ID</option>
          </select>
        </div>
      </div>

      {/* Таблица */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-x-auto">
        {loading ? (
          <div className="flex justify-center items-center py-10">
            <Spin />
          </div>
        ) : (
          <table className="min-w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">ID</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Наименование</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Клиент</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Создал</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Статус</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Дата создания</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Действия</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {sortedCalculations.map(calc => (
                <tr key={calc.id} className="hover:bg-gray-50">
                  <td className="px-4 py-4 text-sm">{calc.id}</td>
                  <td className="px-4 py-4 text-sm">{calc.name}</td>
                  <td className="px-4 py-4 text-sm">{calc.customerName}</td>
                  <td className="px-4 py-4 text-sm">{calc.createdBy}</td>
                  <td className="px-4 py-4 text-sm">
                    <span className={`inline-block px-2 py-1 rounded text-white text-xs ${calc.statusColor}`}>
                      {calc.status}
                    </span>
                  </td>
                  <td className="px-4 py-4 text-sm">{calc.createdAt}</td>
                  <td className="px-4 py-4 text-sm">
                    <div className="flex gap-2">
                      <button
                        className="text-blue-600 hover:underline"
                        onClick={() => handleAction("Просмотр", calc.id)}
                      >
                        Просмотр
                      </button>
                      <button
                        className="text-green-600 hover:underline"
                        onClick={() => handleAction("Редактировать", calc.id)}
                      >
                        Редактировать
                      </button>
                      <button
                        className="text-red-600 hover:underline"
                        onClick={() => handleArchive(calc.id)}
                      >
                        Архивировать
                      </button>
                      {calc.status === "Создан" && (
                      <button
                        className="text-purple-600 hover:underline"
                        onClick={() => {
                          setSelectedOrderId(calc.id)
                          setDiscountComment("")
                          setIsDiscountModalOpen(true)
                        }}
                      >
                        Запросить скидку
                      </button>
                    )}
                    </div>
                  </td>
                </tr>
              ))}
              {sortedCalculations.length === 0 && (
                <tr>
                  <td colSpan={7} className="text-center py-6 text-gray-500">
                    Расчеты не найдены
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* Пагинация */}
      <div className="flex justify-between items-center mt-4">
        <Button
          disabled={!prevUrl}
          onClick={() => fetchData(prevUrl!)}
        >
          ← Предыдущая
        </Button>
        <Button
          disabled={!nextUrl}
          onClick={() => fetchData(nextUrl!)}
        >
          Следующая →
        </Button>
      </div>
      <Modal
        title="Запросить скидку"
        open={isDiscountModalOpen}
        onCancel={() => setIsDiscountModalOpen(false)}
        onOk={() => {
          if (!discountComment.trim()) {
            message.warning("Введите комментарий перед отправкой")
            return
          }
          if (selectedOrderId) {
            handleDiscountRequest(selectedOrderId, discountComment)
          }
          setIsDiscountModalOpen(false)
        }}
        okText="Отправить"
        cancelText="Отмена"
      >
        <p className="mb-2">Комментарий:</p>
        <textarea
          className="w-full border border-gray-300 rounded-md p-2 resize-none"
          rows={4}
          placeholder="Например: Прошу скидку, так как клиент запросил лучшее предложение..."
          value={discountComment}
          onChange={(e) => setDiscountComment(e.target.value)}
        />
      </Modal>
    </div>
  )
}

