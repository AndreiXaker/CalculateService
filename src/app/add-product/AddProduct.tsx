'use client';
import { useState } from 'react';
import Image from 'next/image';
import {
  Input,
  Button,
  Table,
  Space,
  Typography,
  Popconfirm,
  message,
  Modal,
  Popover
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { addBase, createProduct, GptSearch, ImportExcel, SearchPids, searchUnknownProduct, waitForJobResult } from '../services/api/products';
import { Upload } from 'antd';
import { UploadOutlined } from '@ant-design/icons';
import type { UploadProps } from 'antd';
const { Title } = Typography;
const { Search } = Input;
import { useProductStore } from '@/store/useProductStore';
import { useCalculationStore } from '@/store/useCalculationStore';
import { calculateOrder } from '../services/api/products';
// import { INewProduct } from '../types/product.interface';
import { useRouter } from 'next/navigation';
import { INewProduct } from '../types/product.interface';
import { AiOutlineRobot } from 'react-icons/ai';

interface RawResponse {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  found_in_gpl: Record<string, any>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  found_in_itprice: Record<string, any>;
  
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  found_in_ebay: Record<string, any>;
}

interface Product {
  key: string;
  sku: string;
  vendor? : string,
  description: string;
  price_gpl?: number | null;
  loaded_at: string;
  ebay_price? : number | null; 
  quantity? : number
  manual? : boolean,
  job_id_itprice? : string | null,
  job_id_ebay? : string | null
}

export default function ProductPage() {
  const [rows, setRows] = useState<Product[]>([]);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [selectedItems, setSelectedItems] = useState<Product[]>([]);
  const [loadingSearch, setLoadingSearch] = useState(false);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const[ unknownPid, setUnknownPid] = useState('')
  const [manualPrice, setManualPrice] = useState('');
  const [isProductMissing, setIsProductMissing] = useState(false);
  const [gptInput, setGptInput] = useState('');
  const [showGptBar, setShowGptBar] = useState(false);
  const { setSelectedProducts } = useProductStore()
  const { params } = useCalculationStore()
  const { inn, customerName, planned_start_date, slaIds, description } = params;
  const router = useRouter()
  const [manualEbayPrice, setManualEbayPrice] = useState('');
  const [pagination, setPagination] = useState({
  current: 1,
  pageSize: 10,  
});
const [manualManufacturer, setManualManufacturer] = useState('');

//   useEffect(() => {
//   if (rows.length === 0) return;

//   const interval = setInterval(async () => {
//     try {
//       const skus = rows
//         .filter(item => !item.manual)
//         .map(item => item.sku);

//       if (skus.length === 0) return;

//       const freshData = await SearchPids(skus);
//       const updatedProducts: Product[] = [];

//       for (const sku of skus) {
//         const gpl = freshData.found_in_gpl[sku];
//         const it = freshData.found_in_itprice[sku];
//         const ebay = freshData.found_in_ebay[sku];

//         updatedProducts.push({
//           key: sku,
//           sku,
//           vendor: it?.vendor || gpl?.vendor || '',
//           description: it?.description || gpl?.description || 'Нет описания',
//           price_gpl: it?.price_gpl || gpl?.price_gpl || '',
//           loaded_at: it?.loaded_at
//             ? new Date(it.loaded_at).toLocaleString('ru-RU')
//             : gpl?.loaded_at
//             ? new Date(gpl.loaded_at).toLocaleString('ru-RU')
//             : '',
//           ebay_price: ebay?.median_usd || '',
//           quantity: rows.find(r => r.sku === sku)?.quantity ?? 1,
//         });
//       }

      
//       setRows(prev => [
//         ...updatedProducts, 
//         ...prev.filter(item => item.manual), 
//       ]);
//     } catch (error) {
//       console.error('Ошибка обновления данных продуктов', error);
//     }
//   }, 3000);

//   return () => clearInterval(interval);
// }, [rows]);


const resetUnknownState = () => {
  setIsModalVisible(false);
  setUnknownPid('');
  setManualPrice('');
  setIsProductMissing(false);
  setManualEbayPrice('')
  
};





//Поиск неизвестного продукта
const handleUnknownProductSearch = async () => {
  const pid = unknownPid.trim().toUpperCase();
  if (!pid) {
    message.warning("Введите SKU");
    return;
  }

  try {
    const result = await searchUnknownProduct(pid);

    if (!result.exists) {
      
      setIsProductMissing(true);
      message.info("Продукт не найден. Введите все данные вручную.");
      return;
    }

    const gpl = result.prices?.gpl;
    const ebay = result.prices?.ebay;
    const it = result.prices?.it;

    const hasGpl = !!gpl?.price_gpl;
    const hasEbay = !!ebay?.price_gpl;

    if (hasGpl && hasEbay) {
     
      const newItem: Product = {
        key: pid + "_unknown_" + Date.now(),
        sku: pid,
        vendor: it?.vendor || gpl?.vendor || '',
        description: it?.description || gpl?.description || 'Нет описания',
        price_gpl: Number(gpl.price_gpl),
        ebay_price: Number(ebay.price_gpl),
        loaded_at: gpl?.loaded_at
          ? new Date(gpl.loaded_at).toLocaleString('ru-RU')
          : ebay?.loaded_at
          ? new Date(ebay.loaded_at).toLocaleString('ru-RU')
          : new Date().toLocaleString('ru-RU'),
        quantity: 1,
      };

      setRows((prev) => [...prev, newItem]);
      message.success("Продукт добавлен");
      resetUnknownState();
    } else {
      
      setIsProductMissing(true);
      setManualPrice(hasGpl ? String(gpl.price_gpl) : "");
      setManualEbayPrice(hasEbay ? String(ebay.price_gpl) : "");
      setUnknownPid(pid);
      message.info("Не хватает цены. Укажите недостающую вручную.");
    }
  } catch (err) {
    console.error("Ошибка запроса неизвестного продукта:", err);
  }
};


//GPT Поиск
const handleGptSearch = async (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) {
    message.warning("Введите текст для поиска PID");
    return;
  }

  try {
    setLoadingSearch(true);

    const pids = await GptSearch(trimmed);

    if (!pids.length) {
      message.error("GPT не нашёл ни одного PID");
      return;
    }

  
    await handleSearch(pids.join(','));
  } catch (err) {
    console.error(err);
    message.error("Ошибка при поиске через GPT");
  } finally {
    setLoadingSearch(false);
  }
};

//Создание продукта
const handleManualCreateProduct = async () => {
  const pid = unknownPid.trim().toUpperCase();
  const gpl = manualPrice ? Number(manualPrice) : null;
  const ebay = manualEbayPrice ? Number(manualEbayPrice) : null;

  if (!pid) {
    message.warning("Введите SKU");
    return;
  }

  if (gpl === null && ebay === null) {
    message.warning("Введите хотя бы одну цену (GPL или eBay)");
    return;
  }

  const payload: INewProduct = {
    sku: pid,
    manufacturer: manualManufacturer,
    price_gpl: gpl,
    price_ebay: ebay,
  };

  try {
    await createProduct(payload);

    setRows(prev => {
      const exists = prev.find(p => p.sku === pid);

      if (exists) {
        
        return prev.map(p =>
          p.sku === pid
            ? {
                ...p,
                vendor: manualManufacturer || p.vendor,
                price_gpl: gpl ?? p.price_gpl,
                ebay_price: ebay ?? p.ebay_price,
              }
            : p
        );
      } else {
        
        const newItem: Product = {
          key: pid + "_manual_" + Date.now(),
          sku: pid,
          vendor: manualManufacturer,
          description: 'Нет описания',
          price_gpl: gpl,
          ebay_price: ebay,
          loaded_at: new Date().toLocaleString('ru-RU'),
          quantity: 1,
          manual: true,
        };
        return [newItem, ...prev];
      }
    });

    message.success("Продукт сохранён");
    resetUnknownState();
  } catch (err) {
    console.error("Ошибка при создании продукта:", err);
    message.error("Не удалось создать продукт");
  }
};




// Excel файлы 
const handleExcelUploadFactory = (): UploadProps["customRequest"] => {
  return async (options) => {
    const { file, onSuccess, onError } = options;

    try {
      const skus = await ImportExcel(file as File);

      if (!skus.length) {
        message.error("Не удалось извлечь SKU из файла");
        onSuccess?.("ok");
        return;
      }

      
       await handleSearch(skus.join(','));

      message.success(`Загружено SKU: ${skus.length}`);
      onSuccess?.("ok");
    } catch (err) {
      message.error("Ошибка при обработке Excel");
      onError?.(err as Error);
    }
  };
};

// Поиск 3 в 1
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
        ebay_price: toNumber(ebay?.median_usd ?? ebay?.median ?? ebay?.price_gpl) ?? null,
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
              if (parsed !== null) product.ebay_price = parsed;

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

      // Ждём itprice, если его нет, но есть job_id (логика как была)
      if (!hasIt && data.job_id_itprice) {
        try {
          const itResult = await waitForJobResult(data.job_id_itprice, 'itprice');
          if (itResult) {
            // поддерживаем разные формы: found_in_itprice[pid] || объект || массив
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

    setRows((prev) => {
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





  const catalogColumns: ColumnsType<Product> = [
    { title: 'SKU', dataIndex: 'sku', key: 'sku' },
    { title: 'Производитель', dataIndex: 'vendor', key: 'vendor',
      render : (text,record) => {
        const isMissing = !record.price_gpl && !record.ebay_price && (record.description === 'Нет описания' || !record.description);
        return isMissing ? (
        <span style={{ color: 'red', fontStyle: 'italic' }}>
          Продукт не найден.Создайте продукт с тем же названием
        </span>
      ) : (
        text || 'Производитель не найден'
      );
    },
  },
    { title: 'Цена GPL, $', dataIndex: 'price_gpl', key: 'price_gpl' },
    { title: 'Цена eBay, $', dataIndex: 'ebay_price', key: 'ebay_price' },
    { title: 'Добавлено', dataIndex: 'loaded_at', key: 'loaded_at' },
  ];

  const basketColumns: ColumnsType<Product> = [
    { title: 'SKU', dataIndex: 'sku', key: 'sku' },
    {title : 'Производитель', dataIndex : 'vendor',key : 'vendor'},
    { title: 'Цена GPL, $', dataIndex: 'price_gpl', key: 'price_gpl' },
    { title: 'Цена eBay, $', dataIndex: 'ebay_price', key: 'ebay_price' },
    { title: 'Добавлено', dataIndex: 'loaded_at', key: 'loaded_at' },
    {
      title: 'Действия',
      key: 'action',
      render: (_, record) => (
        <Popconfirm
          title="Удалить продукт?"
          okText="Да"
          cancelText="Нет"
          onConfirm={() => {
            setSelectedItems((prev) =>
              prev.filter((item) => item.key !== record.key)
            );
          }}
        >
          <Button danger size="small">
            Удалить
          </Button>
        </Popconfirm>
      ),
    },
    {
    title: 'Количество',
    dataIndex: 'quantity',
    key: 'quantity',
    render: (_, record, index) => (
      <Input
        type="number"
        min={1}
        value={record.quantity ?? 1}
        onChange={(e) => {
          const updated = [...selectedItems];
          updated[index].quantity = parseInt(e.target.value, 10) || 1;
          setSelectedItems(updated);
        }}
        style={{ width: 80 }}
      />
    ),
  },
  ];

  const rowSelection = {
    selectedRowKeys,
    onChange: (keys: React.Key[]) => setSelectedRowKeys(keys),
  };

 const addToBasket = async () => {
  const selected = rows.filter((r) => selectedRowKeys.includes(r.key));

  if (!selected.length) {
    message.warning("Выберите хотя бы один продукт");
    return;
  }

  
  const hasMissingPrice = selected.some(
    (p) => !p.price_gpl || !p.ebay_price
  );

  if (hasMissingPrice) {
    message.error("Все выбранные продукты должны иметь цены (GPL и eBay). Добавьте при необходимости вручную.");
    return;
  }

  
  for (const product of selected) {
    try {
      // itprice
      if (product.job_id_itprice) {
        await addBase(product.job_id_itprice, "itprice");
      }

      // ebay
      if (product.job_id_ebay) {
        await addBase(product.job_id_ebay, "ebay");
      }

      setSelectedItems((prev) => {
        if (prev.find((p) => p.key === product.key)) return prev;
        return [...prev, { ...product, quantity: product.quantity ?? 1 }];
      });

      message.success(`Проудкт ${product.sku} добавлен`);
    } catch (err) {
      console.error(`Ошибка добавления ${product.sku}:`, err);
      message.error(`Не удалось добавить ${product.sku}`);
    }
  }

  setSelectedRowKeys([]);
};




  const confirmBasket = async () => {
  if (!selectedItems.length) {
    message.warning("Выберите хотя бы один продукт");
    return;
  }

  const orderPayload = {
    inn,
    customer_name: customerName,
    planned_start_date: planned_start_date,
    sla_ids: slaIds,
    description,
    products: selectedItems.map(item => ({
      sku: item.sku,
      quantity: item.quantity ?? 1,
      price_gpl: item.price_gpl,
      vendor: item.vendor,
    })),
  };

  try {
    const response = await calculateOrder(orderPayload)
    if (response?.order_id) {
    message.success('Расчет успешно выполнен')
    setSelectedItems([])
    setSelectedProducts([])
    router.push('/main')
    }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (err : any) {
    const innError = err?.response?.data?.error === "ИНН должен содержать ровно 10 цифр."
    if (innError) {
      message.error('Ошибка: ИНН должен содержать ровно 10 цифр.')
    } else {
      const errorMsg = err?.response?.data?.error || "Неизвестная ошибка при создании заказа";
      message.error(errorMsg);
    }
    console.error('Ошибка при отправке запроса',err)
  } 
};

  return (
    <div className="p-6 bg-white rounded-lg shadow-md max-w-6xl mx-auto mt-8">
      <Title level={4}>Поиск и выбор PID</Title>

      <Space wrap className="mb-4">
        <Search
          placeholder="Введите PID через запятую или пробел"
          onSearch={handleSearch}
          loading={loadingSearch}
          enterButton="Поиск"
          style={{ width: 400 }}
          allowClear
        />
        
        <Popover
        content={
          <div style={{ textAlign: 'center' }}>
            <p>Пример правильного Excel:</p>
              <Image
                src="/helpExcel.png" 
                alt="Пример Excel"
                width={300}
                height={300}
              />
            </div>
          }
        title="Формат Excel"
        trigger="hover"
      >
        <Upload
          accept=".xlsx,.xls"
          showUploadList={false}
          customRequest={handleExcelUploadFactory()}
        >

          <Button icon={<UploadOutlined />}>
            Загрузить Excel
          </Button>
        </Upload>
        </Popover>
        <Button
          type="dashed"
          onClick={() => setIsModalVisible(true)}
          
        >
          Создать продукт
        </Button>
        <div className="w-full">
        <Button
          type="default"
          icon={<AiOutlineRobot size={18} style={{verticalAlign : 'middle'}}/>}
          onClick={() => setShowGptBar(prev => !prev)}
          className="flex items-center"
        >
          {showGptBar ? 'Скрыть GPT-поиск' : 'GPT-поиск по описанию'}
        </Button>

        <div
          className={`overflow-hidden transition-all duration-500 ease-in-out ${
            showGptBar ? 'max-h-80 mt-4 opacity-100' : 'max-h-0 opacity-0'
          }`}
        >
          <div className="bg-gray-50 border border-dashed border-gray-300 rounded-md p-4 flex flex-col sm:flex-row items-center gap-4">
            <Input.TextArea
              rows={2}
              placeholder="Опишите, что ищете (например: сервер HP 2U 64GB RAM)..."
              value={gptInput}
              onChange={(e) => setGptInput(e.target.value)}
              onPressEnter={() => handleGptSearch(gptInput)}
              className="flex-1"
            />
            <Button
              type="primary"
              loading={loadingSearch}
              onClick={() => handleGptSearch(gptInput)}
              className="w-full sm:w-auto"
            >
              Найти SKU
            </Button>
          </div>
          <p className="text-gray-500 mt-2 text-sm">
            GPT попытается найти соответствующие SKU на основе описания, которое вы введёте.
          </p>
        </div>
      </div>
      </Space>

      <Table
        columns={catalogColumns}
        dataSource={rows}
        rowSelection={rowSelection}
        pagination={{
        current: pagination.current,
        pageSize: pagination.pageSize,
        onChange: (page, pageSize) => {
          setPagination({ current: page, pageSize: pageSize || 10 });
        },
        showSizeChanger: true,
        pageSizeOptions: ['10', '20', '30', '50'],
        total: rows.length,  
      }}
        bordered
        locale={{ emptyText: 'Нет данных для выбора' }}
      />
      {selectedRowKeys.length > 0 && (
        <div className="mt-4 text-right">
          <Button type="primary" onClick={addToBasket}>
            Добавить
          </Button>
        </div>
      )}
      <Title level={4} className="mt-8">
        Выбранные продукты
      </Title>
      <Table
        columns={basketColumns}
        dataSource={selectedItems}
        pagination={false}
        bordered
        locale={{ emptyText: 'Нет выбранных продуктов' }}
        rowKey="key"
      />

      {selectedItems.length > 0 && (
        <div className="mt-4 text-right">
          <Button type="primary" onClick={confirmBasket}>
            Подтвердить
          </Button>
        </div>
      )}
      <Modal
      title="Поиск неизвестного продуктов"
      open={isModalVisible}
      onCancel={resetUnknownState}
      onOk={isProductMissing ? handleManualCreateProduct : handleUnknownProductSearch}
      okText={isProductMissing ? "Создать продукт" : "Найти"}
      cancelText="Отмена"
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <Input
          placeholder="Введите SKU"
          value={unknownPid}
          onChange={(e) => setUnknownPid(e.target.value)}
          disabled={isProductMissing}
        />

        {isProductMissing && (
          <>
          <Input
            placeholder="Введите производителя"
            value={manualManufacturer}
            onChange={(e) => setManualManufacturer(e.target.value)}
          />
          <Input
            type="number"
            placeholder="Введите цену вручную"
            value={manualPrice}
            onChange={(e) => setManualPrice(e.target.value)}
          />
          <Input
          type="number"
          placeholder="Введите цену eBay вручную"
          value={manualEbayPrice}
          onChange={(e) => setManualEbayPrice(e.target.value)}
        />
        </>
        )}
      </div>
    </Modal>
    </div>
  );
}
