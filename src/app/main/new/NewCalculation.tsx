"use client";

import { Button, DatePicker, Input, Select } from "antd";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import dayjs from "dayjs";
import { useCalculationStore } from "@/store/useCalculationStore";

const slaOptions = [
  { label: "8x5", value: "8x5" },
  { label: "8x5 NBD", value: "8x5_nbd" },
  { label: "24x7", value: "24x7" },
  { label: "24x7 NBD", value: "24x7_nbd" },
];

export default function NewCalculation() {
  const router = useRouter();
  
  const { params, setParams, resetParams} = useCalculationStore();
  const { inn, customerName, planned_start_date, slaIds, description } = params;
  const [innError, setInnError] = useState<string | null>(null);

  const calcName = useMemo(() => {
    if (slaIds.length && customerName && planned_start_date) {
      return `${slaIds.join(", ")} ${customerName} ${planned_start_date}`;
    }
    return "";
  }, [slaIds, customerName, planned_start_date]);

  useEffect(() => {
  resetParams(); 
  }, []);

  useEffect(() => {
    if (inn && inn.length !== 10) {
      setInnError("ИНН должен содержать ровно 10 цифр");
    } else {
      setInnError(null);
    }
  }, [inn]);

  const handleNext = () => {
    router.push("/add-product");
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center">
        <h1 className="text-2xl font-semibold text-gray-900">Новый расчет</h1>
        <button
          onClick={() => router.push("/main")}
          className="text-gray-600 hover:text-gray-900 text-sm"
        >
          Отмена
        </button>
      </div>

      <div className="flex gap-6 p-6">
        <div className="flex-1 space-y-6">
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="mb-4">
              <h2 className="text-lg font-semibold text-gray-900 mb-1">
                Параметры расчета
              </h2>
              <p className="text-sm text-gray-500">
                Введите основную информацию о расчете
              </p>
            </div>

            <div className="space-y-4">
              {/* ИНН */}
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">
                  ИНН
                </label>
                <Input
                  type="text"
                  value={inn}
                  onChange={(e) => {
                    const value = e.target.value.replace(/\D/g, "");
                    setParams({ inn: value });
                  }}
                  placeholder="Введите ИНН"
                  className="w-full"
                />
                {innError && (
                  <p className="text-red-500 text-xs mt-1">{innError}</p>
                )}
              </div>

              {/* Наименование заказчика */}
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">
                  Наименование заказчика
                </label>
                <Input
                  value={customerName}
                  onChange={(e) =>
                    setParams({ customerName: e.target.value })
                  }
                  placeholder="Введите наименование заказчика"
                  className="w-full"
                />
              </div>

              {/* Дата начала */}
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">
                  Дата начала действия контракта
                </label>
                <DatePicker
                  onChange={(date) =>
                    setParams({
                      planned_start_date: date ? date.format("DD.MM.YYYY") : "",
                    })
                  }
                  placeholder="Выберите дату"
                  format="DD.MM.YYYY"
                  className="w-full"
                  value={planned_start_date ? dayjs(planned_start_date,"DD.MM.YYYY") : null}
                />
              </div>

              {/* Описание */}
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">
                  Описание
                </label>
                <Input.TextArea
                  value={description}
                  onChange={(e) =>
                    setParams({ description: e.target.value })
                  }
                  placeholder="Дополнительная информация о расчете"
                  className="w-full"
                  autoSize={{ minRows: 2, maxRows: 4 }}
                />
              </div>

              {/* SLA мультиселект */}
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">
                  SLA
                </label>
                <Select
                  mode="multiple"
                  allowClear
                  placeholder="Выберите SLA"
                  value={slaIds}
                  onChange={(values) => setParams({ slaIds: values })}
                  options={slaOptions}
                  className="w-full"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Вы можете выбрать несколько SLA
                </p>
              </div>

              {/* Наименование расчета */}
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">
                  Наименование расчета
                </label>
                <Input
                  value={calcName}
                  disabled
                  className="w-full bg-gray-100 cursor-not-allowed"
                />
              </div>
            </div>
          </div>

          <Button
            type="primary"
            onClick={handleNext}
            disabled={
              !inn ||
              !!innError ||
              !customerName ||
              slaIds.length === 0 ||
              !planned_start_date
            }
          >
            Добавить продукты
          </Button>
        </div>
      </div>
    </div>
  );
}
