'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import {
  Spin,
  Button,
  Input,
  InputNumber,
  message,
  Form,
  DatePicker,
  Checkbox,
  Table,
  Modal,
  Upload,
  UploadProps,
} from 'antd'
import { UploadOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import type { ColumnsType } from 'antd/es/table'
import { addBase, editOrder, GptSearch, saveEditedOrder } from '@/app/services/api/products'
import {
  searchUnknownProduct,
  createProduct,
  SearchPids,
  waitForJobResult,
  ImportExcel,
} from '@/app/services/api/products'
import { IOrder } from '@/app/types/orders.interface'
import { INewProduct } from '@/app/types/product.interface'


interface RawResponse {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  found_in_gpl: Record<string, any>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  found_in_itprice: Record<string, any>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  found_in_ebay: Record<string, any>
}

interface Product {
  key: string
  sku: string
  vendor?: string
  description: string
  price_gpl? : number | null
  loaded_at: string
  price_ebay?: number | null
  quantity?: number
  manual?: boolean
  job_id_itprice?: string | null
  job_id_ebay?: string | null
}

const fixedSlaOptions = [
  { label: '24x7 NBD', value: '24x7_nbd' },
  { label: '24x7', value: '24x7' },
  { label: '8x5 NBD', value: '8x5_nbd' },
  { label: '8x5', value: '8x5' },
]

export default function OrderEdit() {
  const params = useParams()
  const orderId = params.id as string
  const router = useRouter()
  const [form] = Form.useForm()
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [loadingSearch, setLoadingSearch] = useState(false)
  const [products, setProducts] = useState<Product[]>([])
  const [selectedSla, setSelectedSla] = useState<string[]>([])
  const [isModalVisible, setIsModalVisible] = useState(false)
  const [unknownPid, setUnknownPid] = useState('')
  const [isProductMissing, setIsProductMissing] = useState(false)
  const [manualPrice, setManualPrice] = useState('')
  const [manualEbayPrice, setManualEbayPrice] = useState('')
  const [manualManufacturer, setManualManufacturer] = useState('')
  const [gptDescription, setGptDescription] = useState('')
 

  const normalizePrice = (price: string | number | null | undefined) => {
  if (!price) return null; 
  
 const str = String(price).replace(/\s+/g, '').replace(',', '.');
 const parsed = Number(str);
  
  return isNaN(parsed) ? null : parsed;
}

  useEffect(() => {
    if (!orderId) return

    const fetch = async () => {
      try {
        setLoading(true)
        const order: IOrder = await editOrder(orderId)
      
        

        const selected = Object.keys(order.support_costs || {})
          .map(k => k.toLowerCase().replace(/\s/g, '_'))
          .filter(val => fixedSlaOptions.some(opt => opt.value === val))
        setSelectedSla(selected)

        form.setFieldsValue({
          inn: order.inn,
          customer_name: order.customer_name,
          planned_start_date: order.planned_start_date ? dayjs(order.planned_start_date,"DD.MM.YYYY") : null,
          description: order.description,
          sla_ids: selected
        })

        const items = (order.order_items || []).map((item, index) => {
          
          
          return {
          key: `${item.sku}_${index}`,
          sku: item.sku,
          vendor: item.manufacturer || '',
          description: item.description || 'Нет описания',
          price_gpl: normalizePrice(item.price_gpl),
          price_ebay: normalizePrice(item.price_ebay),
          loaded_at: new Date(item.loaded_at || Date.now()).toLocaleString('ru-RU'),
          quantity: item.quantity || 1
          }
        })

        setProducts(items)
      } catch (err) {
        console.error('Ошибка загрузки отсчета:', err)
        message.error('Не удалось загрузить данные отсчета')
      } finally {
        setLoading(false)
      }
    }

    fetch()
  }, [orderId, form])

  

  const handleSlaChange = (checkedValues: string[]) => {
    if (checkedValues.length > 4) {
      message.warning('Можно выбрать не более 4 SLA')
      return
    }
    setSelectedSla(checkedValues)
    form.setFieldValue('sla_ids', checkedValues)
  }

  const handleExcelUploadFactory = (): UploadProps["customRequest"] => {
  return async (options) => {
    const { file, onSuccess, onError } = options;

    setLoadingSearch(true);

    try {
      const skus = await ImportExcel(file as File);
    

      if (!skus.length) {
        message.error("Не удалось извлечь SKU из файла");
        onSuccess?.("ok");
        return;
      }

      await handleSearch(skus.join(",")); 

      message.success(`Загружено SKU: ${skus.length}`);
      onSuccess?.("ok");
    } catch (err) {
      console.error("Ошибка при обработке Excel:", err);
      message.error("Ошибка при обработке Excel");
      onError?.(err as Error);
    } finally {
      setLoadingSearch(false); 
    }
  };
};



  const handleProductChange = (index: number, field: keyof Product, value: string | number | null) => {
  const updated = [...products]
  if (field === 'price_gpl' || field === 'price_ebay') {
    updated[index][field] = value === null ? null : Number(value)
  } else {
    updated[index][field] = value as never
  }
  setProducts(updated)
}

  const handleSearch = async (value: string) => {
    const trimmed = value.trim();
    if (!trimmed) {
      message.warning('Введите запрос для поиска');
      return;
    }
  
    setLoadingSearch(true);
  
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const toNumber = (v: any): number | null => {
      if (v === null || v === undefined) return null;
      const s = String(v).trim();
      if (!s) return null;
      const normalized = s.replace(/\s+/g, '').replace(',', '.');
      const n = Number(normalized);
      return Number.isFinite(n) ? n : null;
    };
  
    try {
      const pids = trimmed
        .split(/[\s,;]+/)
        .map((s) => s.trim().toUpperCase())
        .filter(Boolean);
  
      if (!pids.length) {
        message.warning('Неверный формат ввода');
        return;
      }
  
      const data = (await SearchPids(pids)) as RawResponse & {
        job_id_itprice: string | null;
        job_id_ebay: string | null;
      };
  
      const result: Product[] = [];
  
      for (const pid of pids) {
        const gpl = data.found_in_gpl?.[pid];
        const it = data.found_in_itprice?.[pid];
        const ebay = data.found_in_ebay?.[pid];
  
        const hasIt = it && it !== 'no data';
        const hasEbay = ebay && ebay !== 'no data';
  
        const product: Product = {
          key: pid,
          sku: pid,
          vendor: (it?.vendor || gpl?.vendor || '') as string,
          description: (it?.description || gpl?.description || 'Нет описания') as string,
          price_gpl: toNumber(it?.price_usd ?? it?.price_gpl ?? gpl?.price_usd ?? gpl?.price_gpl) ?? null,
          loaded_at: it?.loaded_at
            ? new Date(it.loaded_at).toLocaleString('ru-RU')
            : gpl?.loaded_at
            ? new Date(gpl.loaded_at).toLocaleString('ru-RU')
            : '',
          price_ebay: toNumber(ebay?.median_usd ?? ebay?.median ?? ebay?.price_gpl) ?? null,
          quantity: 1,
          job_id_itprice: data.job_id_itprice,
          job_id_ebay: data.job_id_ebay,
        };
  
        
        if (!hasEbay && data.job_id_ebay) {
          try {
            const ebayResult = await waitForJobResult(data.job_id_ebay, 'ebay');
            if (ebayResult) {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const maybeEbayEntry: any =
                (ebayResult.found_in_ebay && ebayResult.found_in_ebay[pid]) ||
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                (Array.isArray(ebayResult.result) && ebayResult.result.find((r: any) => String(r.sku).toUpperCase() === pid)) ||
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                (Array.isArray(ebayResult) ? ebayResult.find((r: any) => String(r.sku).toUpperCase() === pid) : null) ||
                ebayResult;
  
              if (maybeEbayEntry) {
                // median, median_usd, adjusted_price_usd, price_gpl и т.д.
                const medianVal = maybeEbayEntry.median ?? maybeEbayEntry.median_usd ?? maybeEbayEntry.adjusted_price_usd ?? maybeEbayEntry.price_gpl ?? maybeEbayEntry.price_usd;
                const parsed = toNumber(medianVal);
                if (parsed !== null) product.price_ebay = parsed;
  
                // не перезаписываем существующие нормальные description/vendor пустыми
                if ((!product.description || product.description === 'Нет описания') && maybeEbayEntry.description) {
                  product.description = maybeEbayEntry.description;
                }
                if ((!product.vendor || product.vendor === '') && (maybeEbayEntry.vendor || maybeEbayEntry.brand)) {
                  product.vendor = maybeEbayEntry.vendor || maybeEbayEntry.brand || product.vendor;
                }
  
                const ts = maybeEbayEntry.timestamp ?? maybeEbayEntry.loaded_at;
                if (ts) product.loaded_at = new Date(ts).toLocaleString('ru-RU');
              }
            }
          } catch (err) {
            console.error(`Job ebay для ${pid} не удался:`, err);
          }
        }
  
        
        if (!hasIt && data.job_id_itprice) {
          try {
            const itResult = await waitForJobResult(data.job_id_itprice, 'itprice');
            if (itResult) {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const itData: any =
                (itResult.found_in_itprice && itResult.found_in_itprice[pid]) ||
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                (Array.isArray(itResult) ? itResult.find((r: any) => String(r.sku).toUpperCase() === pid) : itResult) ||
                itResult;
  
              if (itData) {
                const parsedGpl = toNumber(itData.price_gpl ?? itData.price_usd ?? itData.price);
                if (parsedGpl !== null) product.price_gpl = parsedGpl;
  
                if ((!product.description || product.description === 'Нет описания') && itData.description) {
                  product.description = itData.description;
                }
                if ((!product.vendor || product.vendor === '') && (itData.vendor || itData.brand)) {
                  product.vendor = itData.vendor || itData.brand || product.vendor;
                }
                if (itData.loaded_at) product.loaded_at = new Date(itData.loaded_at).toLocaleString('ru-RU');
                if (itData.timestamp) product.loaded_at = new Date(itData.timestamp).toLocaleString('ru-RU');
              }
            }
          } catch (err) {
            console.error(`Job itprice для ${pid} не удался:`, err);
          }
        }
  
        result.push(product);
      }
  
      if (!result.length) {
        message.info('Ничего не найдено ни по названию, ни по PID');
        return;
      }
  
      setProducts((prev) => {
      const newItems = result.filter((item) => !prev.find((p) => p.key === item.key));
      return [...newItems, ...prev];
    });
  
      message.success(`Найдено и добавлено: ${result.length}`);
    } catch (err) {
      console.error(err);
      message.error('Ошибка поиска');
    } finally {
      setLoadingSearch(false);
    }
  };


  const handleGptSearch: () => Promise<void> = async () => {
  let description = gptDescription.trim();

  if (!description && unknownPid.trim()) {
    description = unknownPid.trim();
    setGptDescription(description); 
  }

  if (!description) {
    message.warning('Введите описание для GPT поиска');
    return;
  }

  setLoadingSearch(true);

  try {
    const pids = await GptSearch(description);

    if (!pids.length) {
      message.warning('GPT не нашёл ни одного SKU');
    } else {
      await handleSearch(pids.join(','));
    }
  } catch (err) {
    console.error('Ошибка GPT поиска:', err);
    message.error('Ошибка при GPT поиске');
  } finally {
    setLoadingSearch(false);
  }
};

  const handleUnknownProductSearch = async () => {
    const pid = unknownPid.trim().toUpperCase();
    if (!pid) {
      message.warning("Введите SKU");
      return;
    }
  
    try {
      const result = await searchUnknownProduct(pid);
      console.log("Результат поиска:", result);
      if (!result.exists) {
        
        setIsProductMissing(true);
        message.info("Продукт не найден. Введите все данные вручную.");
        return;
      }
  
      const gpl = result.prices?.gpl;
      const ebay = result.prices?.ebay;
      const it = result.prices?.it;
  
      const hasGpl = !!gpl?.price_usd;
      const hasEbay = !!ebay?.price_usd;
  
      if (hasGpl && hasEbay) {
       
        const newItem: Product = {
          key: pid + "_unknown_" + Date.now(),
          sku: pid,
          vendor: it?.vendor || gpl?.vendor || '',
          description: it?.description || gpl?.description || 'Нет описания',
          price_gpl: Number(gpl.price_gpl),
          price_ebay: Number(ebay.price_ebay),
          loaded_at: gpl?.loaded_at
            ? new Date(gpl.loaded_at).toLocaleString('ru-RU')
            : ebay?.loaded_at
            ? new Date(ebay.loaded_at).toLocaleString('ru-RU')
            : new Date().toLocaleString('ru-RU'),
          quantity: 1,
        };
  
        setProducts((prev) => [...prev, newItem]);
        message.success("Продукт добавлен");
        resetUnknownState();
      } else {
        
        setIsProductMissing(true);
        setManualPrice(hasGpl ? String(gpl.price_usd) : "");
        setManualEbayPrice(hasEbay ? String(ebay.price_usd) : "");
        setUnknownPid(pid);
        message.info("Не хватает цены. Укажите недостающую вручную.");
      }
    } catch (err) {
      console.error("Ошибка запроса неизвестного продукта:", err);
    }
  };

  const handleManualCreateProduct = async () => {
    const pid = unknownPid.trim().toUpperCase()
    const gpl = normalizePrice(manualPrice)
    const ebay = normalizePrice(manualEbayPrice)



    if (!pid) {
      message.warning('Введите SKU')
      return
    }
    if (gpl === null && ebay === null) {
      message.warning('Введите хотя бы одну цену (GPL или eBay)')
      return
    }

    const payload: INewProduct = {
      sku: pid,
      manufacturer: manualManufacturer,
      price_gpl: gpl,
      price_ebay: ebay,
    }

    try {
      await createProduct(payload)
      setProducts(prev => {
        const exists = prev.find(p => p.sku === pid)
        if (exists) {
          return prev.map(p =>
            p.sku === pid
              ? {
                  ...p,
                  vendor: manualManufacturer || p.vendor,
                  price_gpl: gpl !== null ? gpl : p.price_gpl,
                  price_ebay: ebay !== null ? ebay : p.price_ebay,
                }
              : p
          )
        } else {
          const newItem: Product = {
            key: pid + '_manual_' + Date.now(),
            sku: pid,
            vendor: manualManufacturer,
            description: 'Нет описания',
            price_gpl: gpl,
            price_ebay: ebay,
            loaded_at: new Date().toLocaleString('ru-RU'),
            quantity: 1,
            manual: true,
          }
          return [newItem, ...prev]
        }
      })
      message.success('Продукт сохранён')
      resetUnknownState()
    } catch (err) {
      console.error('Не удалось создать продукт:', err)
      message.error('Не удалось создать продукт')
    }
  }

  const resetUnknownState = () => {
    setIsModalVisible(false)
    setUnknownPid('')
    setIsProductMissing(false)
    setManualPrice('')
    setManualEbayPrice('')
    setManualManufacturer('')
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
const handleSave = async (values: any) => {
  
  const allProducts = [...products]; 

  const invalidProducts = allProducts.filter(
    (p) => p.price_gpl == null || p.price_ebay == null
  );

  if (invalidProducts.length > 0) {
    message.error('У всех продуктов должны быть заполнены цены (GPL и eBay)');
    return;
  }

  setSubmitting(true);

  try {
    for (const product of allProducts) {
      try {
        if (product.job_id_itprice) await addBase(product.job_id_itprice, "itprice");
        if (product.job_id_ebay) await addBase(product.job_id_ebay, "ebay");
      } catch (err) {
        console.error(`Ошибка добавления ${product.sku} в базу:`, err);
        message.error(`Не удалось добавить ${product.sku} в базу`);
      }
    }

    const payload = {
      ...values,
      planned_start_date: values.planned_start_date
        ? dayjs(values.planned_start_date).format('YYYY-MM-DD')
        : null,
      sla_ids: values.sla_ids || [],
      products: allProducts.map((p) => ({
        sku: p.sku,
        manufacturer: p.vendor,
        quantity: p.quantity,
        price_gpl: p.price_gpl,
        price_ebay: p.price_ebay,
      })),
    };

    await saveEditedOrder(orderId, payload);
    message.success('Изменения сохранены');
    router.push(`/orders/${orderId}`);
  } catch (err) {
    console.error('Ошибка при сохранении отсчета:', err);
    message.error('Ошибка при сохранении отсчета');
  } finally {
    setSubmitting(false);
  }
};




  const productColumns: ColumnsType<Product> = [
  {
    title: 'SKU',
    dataIndex: 'sku',
    key: 'sku',
    render: (_, record) => (
      <span>{record.sku}</span>
    )
  },
  {
  title: 'Производитель',
  dataIndex: 'vendor',
  key: 'vendor',
  render: (text, record) => {
    const isMissing =
      !record.price_gpl &&
      !record.price_ebay &&
      (record.description === 'Нет описания' || !record.description);

    return isMissing ? (
      <span style={{ color: 'red', fontStyle: 'italic' }}>
        Продукт не найден. Создайте продукт с тем же названием
      </span>
    ) : (
      text || 'Производитель не найден'
    );
  }
},
  {
    title: 'Цена GPL',
    dataIndex: 'price_gpl',
    key: 'price_gpl',
    render: (_, record) => (
      record.price_gpl != null ? <span>{record.price_gpl}</span> : <span>-</span>
    )
  },
  {
    title: 'Цена eBay',
    dataIndex: 'price_ebay',
    key: 'price_ebay',
    render: (_, record) => (
      record.price_ebay != null ? <span>{record.price_ebay}</span> : <span>-</span>
    )
  },
  {
    title: 'Количество',
    dataIndex: 'quantity',
    key: 'quantity',
    render: (_, record, index) => (
      <InputNumber
        min={1}
        value={record.quantity ?? 1}
        onChange={v => handleProductChange(index, 'quantity', v ?? 1)}
      />
    )
  },
  {
    title: 'Действия',
    key: 'action',
    render: (_, __, index) => (
      <Button danger onClick={() => setProducts(prev => prev.filter((_, i) => i !== index))}>
        Удалить
      </Button>
    )
  }
]


  if (loading) {
    return (
      <div className="flex justify-center items-center py-20">
        <Spin size="large" />
      </div>
    )
  }

  return (
    <div className="p-4 max-w-6xl mx-auto bg-white rounded shadow">
      <h2 className="text-2xl mb-4">Редактирование отсчета </h2>
      <Form form={form} layout="vertical" onFinish={handleSave}>
        <Form.Item label="ИНН" name="inn">
          <Input />
        </Form.Item>
        <Form.Item label='Описание' name="description">
          <Input/>
        </Form.Item>
        <Form.Item label="Имя клиента" name="customer_name">
          <Input />
        </Form.Item>
        <Form.Item label="Планируемая дата начала действия контракта" name="planned_start_date">
          <DatePicker style={{ width: '100%' }} 
          format="DD.MM.YYYY"
          />
        </Form.Item>
        {/* <Form.Item label="Описание" name="description">
          <Input.TextArea rows={3} />
        </Form.Item> */}

        <h3 className="text-lg font-semibold mt-4 mb-2">Варианты поддержки</h3>
        <Form.Item label="Выберите SLA" name="sla_ids">
          <Checkbox.Group
            options={fixedSlaOptions}
            value={selectedSla}
            onChange={handleSlaChange}
          />
        </Form.Item>

        <h3 className="text-lg font-semibold mt-4 mb-2">Продукты отсчета</h3>

        <div className="flex gap-2 mb-2 items-center">
          <Input.Search
            placeholder="Введите SKU или название"
            enterButton="Найти"
            loading={loadingSearch}
            onSearch={handleSearch}
            style={{ flex: 1 }}
          />
          {/* <Input
            placeholder="GPT поиск"
            value={gptQuery}
            onChange={e => setGptQuery(e.target.value)}
            style={{ width: 200 }}
          />
          <Button onClick={handleGptSearch}>GPT</Button> */}
          <Upload
            accept=".xlsx,.xls"
            showUploadList={false}
            customRequest={handleExcelUploadFactory()}
          >
            <Button icon={<UploadOutlined />}>Загрузить Excel</Button>
          </Upload>
        </div>

        <Table dataSource={products} columns={productColumns} pagination={false} rowKey="key" />

        <div className="flex gap-3 mt-6">
          <Button onClick={() => router.back()} disabled={submitting}>Назад</Button>
          <Button type="primary" htmlType="submit" loading={submitting}>Сохранить изменения</Button>
          <Button type="dashed" onClick={() => setIsModalVisible(true)}>Создать продукт</Button>
        </div>
      </Form>

      <Modal
        title="Добавление продукта"
        open={isModalVisible}
        onCancel={resetUnknownState}
        onOk={isProductMissing ? handleManualCreateProduct : handleUnknownProductSearch}
        okText={isProductMissing ? "Создать продукт" : "Найти"}
        cancelText="Отмена"
      >
        <Input
          placeholder="Введите SKU"
          value={unknownPid}
          onChange={e => setUnknownPid(e.target.value)}
          disabled={isProductMissing}
        />

        {isProductMissing && (
          <div>
            <Button
          type="primary"
          className="mt-2 mb-1"
          onClick={handleGptSearch}
          loading={loadingSearch}
          >
            Поиск GPT
          </Button>
          <Input.TextArea
          placeholder="Введите описание для поиска GPT"
          value={gptDescription}
          rows={2}
          onChange={e => setGptDescription(e.target.value)}
          />
          
          </div>
          )
        }
  

        {isProductMissing && (
          <div className="flex flex-col gap-2 mt-2">
            <Input
              placeholder="Производитель"
              value={manualManufacturer}
              onChange={e => setManualManufacturer(e.target.value)}
            />
            <Input
              placeholder="Цена GPL"
              value={manualPrice}
              onChange={(e) => {
                const val = e.target.value.replace(',', '.');
                if (/^[0-9]*[.,]?[0-9]*$/.test(val) || val === '') {
                  setManualPrice(val);
                }
              }}
            />
            <Input
            placeholder="Цена eBay"
            value={manualEbayPrice}
            onChange={(e) => {
              const val = e.target.value.replace(',', '.');
              if (/^[0-9]*[.,]?[0-9]*$/.test(val) || val === '') {
                setManualEbayPrice(val);
              }
            }}
          />
          </div>
        )}
        {loadingSearch && <Spin size="small" style={{ marginTop: 8 }} />}
      </Modal>
    </div>
  )
}

