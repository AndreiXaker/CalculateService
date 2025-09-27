"use client"
import { useParams, useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { message, Spin } from "antd"
import { getOrderById, orderAccess, acceptOrder } from "@/app/services/api/products"
import { IOrder } from "@/app/types/orders.interface"
import { cancelOrderAccess } from "@/app/services/api/products"

export default function OrderDetail() {
  const { id } = useParams()
  const [data, setData] = useState<IOrder | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [userRole, setUserRole] = useState<'user' | 'manager' | null>(null)
  const router = useRouter()
  useEffect(() => {
    const fetchData = async () => {
      try {
        const data = await getOrderById(id as string)
        setData(data)

        const role = localStorage.getItem("userRole") as 'user' | 'manager' | null
        setUserRole(role)
      } catch (err) {
        console.error(err)
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [id])


const handleCancelOrderAccess = async () => {
    if (!data?.id) return
    setSubmitting(true)
    try {
      await cancelOrderAccess(data.id)
      message.success('Заявка отозвана')
      router.push('/main')
    } catch {
      message.error('Не удалось отозвать заявку')
    } finally {
      setSubmitting(false)
    }
  }


  const handleRejectOrder = async () => {
    if (!data?.id) return
    setSubmitting(true)
    try {
      await acceptOrder(data.id,"rejected")
      message.success('Отсчет отклонен')
      setTimeout(() => {
      router.push("/main")
    }, 800)
    } catch {
      message.error("Только расчет со статусом (На Утверждении) можно отклонить ");
    } finally {
      setSubmitting(false)
    }
  }

  const handleOrderAccess = async () => {
    if (!data?.id) return
    setSubmitting(true)
    try {
      await orderAccess(data.id)
      message.success('Заявка отправлена на одобрение')
      router.push('/main')
    } catch {
      message.error('Ошибка при отправке заявки')
    } finally {
      setSubmitting(false)
    }
  }

    const handleApprove = async () => {
    if (!data?.id) return
    setSubmitting(true)
    try {
      const updatedOrder = await acceptOrder(data.id,'approved')
      message.success("Расчет согласован")
      setTimeout(() => {
      router.push("/main")
    }, 800)
        if (updatedOrder) {
          setData((prev) => prev ? { ...prev, status: updatedOrder.status } : prev)
        }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } catch (error: any) {
        if (error.response?.status === 400) {
          message.error(error.response.data?.detail || "Ошибка: отсчет нельзя одобрить")
        } else {
          message.error("Ошибка при одобрении отсчета")
        }
      } finally {
        setSubmitting(false)
      }
    }

  if (loading) return (
    <div className="flex justify-center items-center py-10">
      <Spin />
    </div>
  )

  if (!data) return <div className="p-4">Данные не найдены</div>

  return (
    <div className="p-4 sm:p-6 max-w-screen-xl mx-auto space-y-6">
     
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h2 className="text-xl sm:text-2xl font-semibold text-gray-900">
          {/* {data.name} <span className="text-gray-500">#{data.id}</span> */}
        </h2>

        <div className="flex gap-3">
        {userRole === "manager" ? (
          (!data.order_files || data.order_files.length === 0) && (
            <>
              <button
                onClick={handleApprove}
                disabled={submitting || data.status === "approved"}
                className={`px-4 py-2 rounded-lg text-white font-medium transition ${
                  submitting ? "bg-gray-400" : "bg-green-600 hover:bg-green-700"
                }`}
              >
                {submitting ? "Обработка..." : data.status === "approved" ? "Одобрено" : "Одобрить"}
              </button>
              <button
                onClick={handleRejectOrder}
                disabled={submitting || data.status === "rejected"}
                className={`px-4 py-2 rounded-lg text-white font-medium transition ${
                  submitting ? "bg-gray-400" : "bg-red-600 hover:bg-red-700"
                }`}
              >
                {submitting ? "Обработка..." : "Отклонить"}
              </button>
            </>
          )
        ) : (
          (!data.order_files || data.order_files.length === 0) && (
            <>
              <button
                onClick={handleOrderAccess}
                disabled={submitting || data.status === "submitted"}
                className={`px-4 py-2 rounded-lg text-white font-medium transition ${
                  submitting || data.status === "submitted"
                    ? "bg-gray-400 cursor-not-allowed"
                    : "bg-blue-600 hover:bg-blue-700"
                }`}
              >
                {submitting ? "Отправка..." : "Отправить на согласование"}
              </button>
              <button
                onClick={() => router.push(`/orders/edit/${data.id}`)}
                className={`px-4 py-2 rounded-lg text-white font-medium transition ${
                "bg-green-600 hover:bg-indigo-700"
              }`}
              >
                  Редактировать
              </button>
              <button
                onClick={handleCancelOrderAccess}
                disabled={submitting }
                className={`px-4 py-2 rounded-lg text-white font-medium transition ${
                  submitting || data.status !== "submitted"
                    ? "bg-red-400 cursor-not-allowed"
                    : "bg-yellow-500 hover:bg-yellow-600"
                }`}
              >
                {submitting ? "Отзыв..." : "Отозвать"}
              </button>
            </>
          )
        )}
      </div>

      </div>

      
  
  <div className="flex gap-6">
  
  <div className="flex-[1] bg-white rounded-xl shadow-md border border-gray-200 p-6">
    <h3 className="text-xl font-semibold text-gray-900 mb-4 border-b border-gray-200 pb-2">Информация о заказчике</h3>
    <div className="text-sm space-y-3">
      <div className="flex justify-between">
        <span className="text-gray-500">Клиент:</span>
        <span className="font-medium">{data.customer_name || "-"}</span>
      </div>
      <div className="flex justify-between">
        <span className="text-gray-500">ИНН:</span>
        <span className="font-medium">{data.inn || "-"}</span>
      </div>
      <div className="flex justify-between">
        <span className="text-gray-500">Описание:</span>
        <span className="font-medium">{data.description || "-"}</span>
      </div>
      <div className="flex justify-between">
        <span className="text-gray-500">Дата создания:</span>
        <span className="font-medium">{new Date(data.created_at).toLocaleString('ru-RU')}</span>
      </div> 
    </div>
  </div>

      
      <div className="flex-[2] bg-white rounded-xl shadow-md border border-gray-200 p-6">
        
  {data.support_costs && Object.keys(data.support_costs).length > 0 && (
  <div className="bg-white rounded-xl shadow-md border border-gray-200 p-6 space-y-4 overflow-x-auto">
    <h3 className="text-lg font-semibold text-blue-600 border-b border-gray-200 pb-2 mb-4">
      Стоимость поддержки и КП по SLA
    </h3>

    <table className="min-w-full text-sm border border-collapse border-gray-300">
      <thead className="bg-gray-100 text-gray-700">
        <tr>
          <th className="border px-4 py-2 text-left">SLA</th>
          <th className="border px-4 py-2 text-right">12 мес</th>
          <th className="border px-4 py-2 text-right">24 мес (-10%)</th>
          <th className="border px-4 py-2 text-right">36 мес (-20%)</th>
          <th className="border px-4 py-2 text-center">КП</th>
        </tr>
      </thead>
      <tbody>
      {Object.entries(data.support_costs).map(([sla, periods]) => {
        const slaFiles = data.order_files?.filter(file => file.kind === "sla_doc") || []
        const relatedFile = slaFiles.find(file => file.file_url.toLowerCase().includes(sla.toLowerCase()))

        return (
          <tr key={sla} className="border-t">
            <td className="border px-4 py-2 font-medium">{sla}</td>
            <td className="border px-4 py-2 text-right">{periods["12_months"] || "-"}</td>
            <td className="border px-4 py-2 text-right">{periods["24_months"] || "-"}</td>
            <td className="border px-4 py-2 text-right">{periods["36_months"] || "-"}</td>
            <td className="border px-4 py-2 text-center">
              {relatedFile ? (
                <a
                  href={relatedFile.file_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-block px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 transition text-xs sm:text-sm"
                >
                  📄 Скачать КП
                </a>
              ) : (
                <span className="text-gray-400 italic">Нет файла</span>
              )}
            </td>
          </tr>
        )
      })}
    </tbody>
    </table>
  </div>
)}


        
        {data.totals && (
          <div className="space-y-2">
            <h3 className="text-lg font-semibold text-green-600 mb-2 border-b border-gray-200 pb-1">Итоги отсчета</h3>
            <div className="text-sm space-y-2">
              <div className="flex justify-between px-2 py-1 bg-gray-50 rounded">
                <span className="text-gray-700">Стоимость продуктов:</span>
                <span className="font-medium">{data.totals.total_gpl_price || "-"}</span>
              </div>
              <div className="flex justify-between px-2 py-1 bg-gray-50 rounded">
                <span className="text-gray-700">Количество продуктов:</span>
                <span className="font-medium">{data.totals.total_pid_count || "-"}</span>
              </div>
              {userRole === "manager" && (<div className="flex justify-between px-2 py-1 bg-gray-50 rounded">
                <span className="text-gray-700">Стоимость ЗИП:</span>
                <span className="font-medium">{data.totals.total_rma_cost || "-"}</span>
              </div>)}
              {userRole === "manager" && (
              <>
              <div className="flex justify-between px-2 py-1 bg-gray-50 rounded">
                <span className="text-gray-700">Количество ЗИП:</span>
                <span className="font-medium">{data.total_zip_qty ?? "-"}</span>
              </div>
                <div className="flex justify-between px-2 py-1 bg-gray-50 rounded">
                  <span className="text-gray-700">Количество человеко-часов Инженера:</span>
                  <span className="font-medium">{data.engineer_hours ?? "-"}</span>
                </div>
                <div className="flex justify-between px-2 py-1 bg-gray-50 rounded">
                  <span className="text-gray-700">Количество человеко-часов Сервисного менеджера:</span>
                  <span className="font-medium">{data.service_manager_hours ?? "-"}</span>
                </div>
              </>
            )}
            </div>
          </div>
        )}
      </div>
    </div>

 
      {/* {data.order_files?.length > 0 && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 space-y-2">
          <h3 className="text-lg font-medium text-gray-900 mb-2">Файлы отсчета</h3>
          <ul className="list-disc pl-5 space-y-1">
            {data.order_files.map((file, idx) => (
              <li key={idx}>
                <a href={file.file_url} target="_blank" className="text-blue-600 hover:underline">
                Скачать КП
                </a>
              </li>
            ))}
          </ul>
        </div>
      )} */}
      {userRole === "manager" && data.excel_url && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 space-y-2">
          <h3 className="text-lg font-medium text-gray-900 mb-2">Выбранные продукты Excel</h3>
          <a
            href={data.excel_url}
            target="_blank"
            className="text-blue-600 hover:underline"
            download
          >
            Выгрузить отсчет
          </a>
        </div>
              )}

      {data.order_items.length > 0 && (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 overflow-x-auto">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Выбранные продукты</h3>
        <table className="min-w-full text-sm border border-collapse border-gray-300">
          <thead className="bg-gray-100 text-gray-700">
            <tr>
              <th className="border px-4 py-2 text-left">SKU</th>
              <th className="border px-4 py-2 text-left">Производитель</th>
              <th className="border px-4 py-2 text-right">Цена GPL</th>
              <th className="border px-4 py-2 text-right">Цена eBay</th>
              <th className="border px-4 py-2 text-center">Количество</th>
              {userRole === "manager" && (
              <th className="border px-4 py-2 text-center">Кол-во ЗИП</th>
              )}
              {userRole === "manager" && (
              <th className="border px-4 py-2 text-right">RMA стоимость</th>)}
            </tr>
          </thead>
          <tbody>
            {data.order_items.map((item, idx) => (
              <tr key={idx} className="border-t">
                <td className="border px-4 py-2">{item.sku}</td>
                <td className="border px-4 py-2">{item.manufacturer || "-"}</td>
                <td className="border px-4 py-2 text-center">{item.quantity}</td>
                <td className="border px-4 py-2 text-right">{item.price_gpl}</td>
                <td className="border px-4 py-2 text-right">{item.price_ebay}</td>
                {userRole === "manager" && (
                  <td className="border px-4 py-2 text-center">{item.zip_quantity}</td>
                )}
                {userRole === "manager" && (
                <td className="border px-4 py-2 text-right">{item.rma_cost}</td>)} 
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )}
    </div>
  )
}
