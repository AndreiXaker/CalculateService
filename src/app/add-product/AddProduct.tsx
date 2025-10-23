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
  Popover,
  Spin
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { addBase, createProduct, ImportExcel, SearchPids, waitForJobResult } from '../services/api/products';
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
// import { AiOutlineRobot } from 'react-icons/ai';

export interface RawResponse {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  found_in_gpl: Record<string, any>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  found_in_itprice: Record<string, any>;
  
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  found_in_ebay: Record<string, any>;
}

export interface Product {
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
  // const [showGptBar, setShowGptBar] = useState(false);
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
// const [gptDescription, setGptDescription] = useState('')

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
const handleUnknownSearch = async () => {
  const trimmed = unknownPid.trim().toUpperCase();
  if (!trimmed) {
    message.warning('Введите SKU');
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
    const pids = trimmed.split(/[\s,;]+/).map((s) => s.trim().toUpperCase()).filter(Boolean);
    if (!pids.length) {
      message.warning('Неверный формат ввода');
      return;
    }

    const data = (await SearchPids(pids)) as RawResponse & {
      job_id_itprice: string | null;
      job_id_ebay: string | null;
    };

    const itpriceResult = data.job_id_itprice ? await waitForJobResult(data.job_id_itprice, 'itprice') : null;
    const ebayResult = data.job_id_ebay ? await waitForJobResult(data.job_id_ebay, 'ebay') : null;

    const pid = pids[0]; // мы ищем только один SKU

    const gpl = data.found_in_gpl?.[pid];
    const it = data.found_in_itprice?.[pid];
    const ebay = data.found_in_ebay?.[pid];

    // Определяем производителя
    let vendor =
      it?.vendor ||
      gpl?.vendor ||
      it?.manufacturer ||
      gpl?.manufacturer ||
      it?.brand ||
      gpl?.brand ||
      '';

    if ((!vendor || vendor === '') && itpriceResult) {
      const itData =
        itpriceResult.found_in_itprice?.[pid] ||
        (Array.isArray(itpriceResult)
          ? itpriceResult.find((r) => String(r.sku).toUpperCase() === pid)
          : null);
      if (itData) vendor = itData.vendor || itData.brand || itData.manufacturer || vendor;
    }

    // Извлекаем цены
    let price_gpl =
      toNumber(it?.price_usd ?? it?.price_gpl ?? gpl?.price_usd ?? gpl?.price_gpl) ?? null;
    let ebay_price =
      toNumber(ebay?.median_usd ?? ebay?.median ?? ebay?.price_gpl ?? ebay?.price_usd) ?? null;

    // Попытка добрать недостающие из job результатов
    if ((price_gpl === null || price_gpl === 0) && itpriceResult) {
      const itData =
        itpriceResult.found_in_itprice?.[pid] ||
        (Array.isArray(itpriceResult)
          ? itpriceResult.find((r) => String(r.sku).toUpperCase() === pid)
          : null);
      if (itData) {
        const jobPrice = toNumber(itData.price_usd ?? itData.price_gpl ?? itData.price);
        if (jobPrice !== null) price_gpl = jobPrice;
      }
    }

    if ((ebay_price === null || ebay_price === 0) && ebayResult) {
      const ebayData =
        ebayResult.found_in_ebay?.[pid] ||
        (Array.isArray(ebayResult.result)
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          ? ebayResult.result.find((r: { sku: any }) => String(r.sku).toUpperCase() === pid)
          : null) ||
        (Array.isArray(ebayResult)
          ? ebayResult.find((r) => String(r.sku).toUpperCase() === pid)
          : null);

      if (ebayData) {
        const jobPrice = toNumber(
          ebayData.median ?? ebayData.median_usd ?? ebayData.price_usd ?? ebayData.price_gpl
        );
        if (jobPrice !== null) ebay_price = jobPrice;
      }
    }

    // Если нашли хотя бы что-то — показать пользователю
    if (vendor || price_gpl || ebay_price) {
      setManualManufacturer(vendor || '');
      setManualPrice(price_gpl ? String(price_gpl) : '');
      setManualEbayPrice(ebay_price ? String(ebay_price) : '');
      setIsProductMissing(true);
      message.success('Данные найдены. Проверьте и при необходимости отредактируйте.');
    } else {
      setIsProductMissing(true);
      message.info('Данные не найдены. Введите вручную.');
    }
  } catch (err) {
    console.error(err);
    message.error('Ошибка поиска');
  } finally {
    setLoadingSearch(false);
  }
};



//GPT Поиск
// const handleGptSearch : () =>  Promise<void> = async () => {
//   let description = gptDescription.trim();

//   if (!description && unknownPid.trim()) {
//     description = unknownPid.trim();
//     setGptDescription(description); 
//   }

//   if (!description) {
//     message.warning('Введите описание для GPT поиска');
//     return;
//   }

//   setLoadingSearch(true);

//   try {
//     const pids = await GptSearch(description);
//     console.log('pids',pids)
//     if (!pids.length) {
//       message.warning('GPT не нашёл ни одного SKU');
//     } else {
//       await handleSearch(pids.join(','));
//     }
//   } catch (err) {
//     console.error('Ошибка GPT поиска:', err);
//     message.error('Ошибка при GPT поиске');
//   } finally {
//     setLoadingSearch(false);
//   }
// };

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
        vendor: (it?.vendor || gpl?.vendor || gpl?.manufacturer || it?.manufacturer || '') as string,
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
              if ((!product.vendor || product.vendor === '') && (maybeEbayEntry.vendor || maybeEbayEntry.brand || maybeEbayEntry.manufacturer)) {
                product.vendor = maybeEbayEntry.vendor || maybeEbayEntry.brand || maybeEbayEntry.manufacturer || product.vendor;
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
              if (
                (!product.vendor || product.vendor === '') &&
                (itData.vendor || itData.brand || itData.manufacturer)
              ) {
                product.vendor = itData.vendor || itData.brand || itData.manufacturer || product.vendor;
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



// const handleUnknownSearch = async (value: string) => {
//   const trimmed = value.trim();
//   if (!trimmed) {
//     message.warning('Введите запрос для поиска');
//     return;
//   }

//   setLoadingSearch(true);

//   // Преобразование строки в число, учитывая разные форматы
//   // eslint-disable-next-line @typescript-eslint/no-explicit-any
//   const toNumber = (v: any): number | null => {
//     if (v === null || v === undefined) return null;
//     const s = String(v).trim();
//     if (!s) return null;
//     const normalized = s.replace(/\s+/g, '').replace(',', '.');
//     const n = Number(normalized);
//     return Number.isFinite(n) ? n : null;
//   };

//   try {
//     const pids = trimmed
//       .split(/[\s,;]+/)
//       .map((s) => s.trim().toUpperCase())
//       .filter(Boolean);

//     if (!pids.length) {
//       message.warning('Неверный формат ввода');
//       return;
//     }

    
//     const data = (await SearchPids(pids)) as RawResponse & {
//       job_id_itprice: string | null;
//       job_id_ebay: string | null;
//     };

//     const result: Product[] = [];

 
// const itpriceResult = data.job_id_itprice ? await waitForJobResult(data.job_id_itprice, 'itprice') : null;
// const ebayResult = data.job_id_ebay ? await waitForJobResult(data.job_id_ebay, 'ebay') : null;

// for (const pid of pids) {
//   const gpl = data.found_in_gpl?.[pid];
//   const it = data.found_in_itprice?.[pid];
//   const ebay = data.found_in_ebay?.[pid];
//   let vendor = it?.vendor || gpl?.vendor || it?.manufacturer || gpl?.manufacturer || it?.brand || gpl?.brand || '';

//   if ((!vendor || vendor === '') && itpriceResult) {
//     const itData =
//       itpriceResult.found_in_itprice?.[pid] ||
//       (Array.isArray(itpriceResult) ? itpriceResult.find((r) => String(r.sku).toUpperCase() === pid) : null);

//     if (itData) {
//       vendor = itData.vendor || itData.brand || itData.manufacturer || vendor;
//     }
//   }

//   const finalVendor = vendor || '';

  
//   let price_gpl = toNumber(it?.price_usd ?? it?.price_gpl ?? gpl?.price_usd ?? gpl?.price_gpl) ?? null;
//   let ebay_price = toNumber(ebay?.median_usd ?? ebay?.median ?? ebay?.price_gpl) ?? null;

//   // Если цена itprice отсутствует, пытаемся взять из job результата
//   if ((price_gpl === null || price_gpl === 0) && itpriceResult) {
//     // Поиск данных по pid в itpriceResult
//     const itData =
//       itpriceResult.found_in_itprice?.[pid] ||
//       (Array.isArray(itpriceResult) ? itpriceResult.find((r) => String(r.sku).toUpperCase() === pid) : null);

//     if (itData) {
//       const jobPrice = toNumber(itData.price_usd ?? itData.price_gpl ?? itData.price);
//       if (jobPrice !== null) price_gpl = jobPrice;
//     }
    
//   }
  

//   // Аналогично для ebay_price
//   if ((ebay_price === null || ebay_price === 0) && ebayResult) {
//     const ebayData =
//       ebayResult.found_in_ebay?.[pid] ||
//       // eslint-disable-next-line @typescript-eslint/no-explicit-any
//       (Array.isArray(ebayResult.result) ? ebayResult.result.find((r: { sku: any; }) => String(r.sku).toUpperCase() === pid) : null) ||
//       (Array.isArray(ebayResult) ? ebayResult.find((r) => String(r.sku).toUpperCase() === pid) : null);

//     if (ebayData) {
//       const jobPrice = toNumber(ebayData.median ?? ebayData.median_usd ?? ebayData.price_usd ?? ebayData.price_gpl);
//       if (jobPrice !== null) ebay_price = jobPrice;
//     }
//   }

//   const product: Product = {
//     key: pid,
//     sku: pid,
//     vendor: finalVendor,
//     description: (it?.description || gpl?.description || 'Нет описания') as string,
//     price_gpl,
//     loaded_at: it?.loaded_at
//       ? new Date(it.loaded_at).toLocaleString('ru-RU')
//       : gpl?.loaded_at
//       ? new Date(gpl.loaded_at).toLocaleString('ru-RU')
//       : '',
//     ebay_price,
//     quantity: 1,
//     job_id_itprice: data.job_id_itprice,
//     job_id_ebay: data.job_id_ebay,
//   };

  
//   const hasData =
//     product.price_gpl !== null ||
//     product.ebay_price !== null ||
//     (product.description && product.description !== 'Нет описания') ||
//     (product.vendor && product.vendor !== '');

//   if (hasData) {
//     console.log(`Добавляем продукт ${pid} с производителем:`, finalVendor);
//     result.push(product);
//   } else {
//     console.log(`⛔ Пропущен ${pid}: нет полезных данных`, product);
//   }
// }

//     setRows((prev) => {
//       const newItems = result.filter((item) => !prev.find((p) => p.key === item.key));
//       return [...newItems, ...prev];
//     });

//     message.success(`Найдено и добавлено: ${result.length}`);
//   } catch (err) {
//     console.error(err);
//     message.error('Ошибка поиска');
//   } finally {
//     setLoadingSearch(false);
//   }
// };






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
    router.push(`/orders/${response.order_id}`)
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
        title="Добавление продукта"
        open={isModalVisible}
        onCancel={resetUnknownState}
        onOk={isProductMissing ? handleManualCreateProduct : handleUnknownSearch}
        okText={isProductMissing ? "Создать продукт" : "Найти"}
        cancelText="Отмена"
      >
        <Input
          placeholder="Введите SKU"
          value={unknownPid}
          onChange={e => setUnknownPid(e.target.value)}
          disabled={isProductMissing}
        />

        {/* {isProductMissing && (
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
        } */}
  

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
  );
}
