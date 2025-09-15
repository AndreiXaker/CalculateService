import axios from "axios";
import Cookies from "js-cookie";
import { INewProduct } from "@/app/types/product.interface";
import { message } from "antd";

const productApi = axios.create({
  baseURL : 'https://calculate-bsshop.ru',
  headers : {
    'Content-Type' : 'application/json'
  }, 
  withCredentials : true
})

productApi.interceptors.request.use((config) => {
  const token = Cookies.get('access_token')
  
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

productApi.interceptors.response.use(
  (response) => response,
  (error) => {
    message.error('Ошибка сервера. Попробуйте позже.');
    return Promise.reject(error);
  }
);
export default productApi

//Главный поиск по пидам
export const SearchPids = async (pids: string[]) => {
    const response = await productApi.post(
      "/product/sku/check-and-parse",
      { pids },
    );
    return response.data;
};

//Excel импорт
export const ImportExcel = async (file: File): Promise<string[]> => {
  const formData = new FormData();
  formData.append("file", file);
  try {
    const response = await productApi.post(
      "/product/import-excel/",
      formData,
      { headers : {"Content-Type" : "multipart/form-data"}}
    );

    const skus = response.data?.data?.map((item: { SKU: string }) => item.SKU) || [];

    return skus;
  } catch (error) {
    message.error("Ошибка при загрузке Excel");
    console.error(error);
    throw error;
  }
};

// Личный кабинет
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const profile = async (paramsOrUrl?: Record<string, any> | string) => {
  try {
    const isUrl = typeof paramsOrUrl === 'string'
    const response = await productApi.get(
      isUrl ? paramsOrUrl : '/product/orders/approved',
      isUrl ? undefined : { params: paramsOrUrl }
    )
    return response.data
  } catch (error) {
    message.error('Заказы не найдены')
    console.error(error)
    throw error
  }
}


// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const calculateOrder = async (orderPayload : any ) => {
  console.log('', JSON.stringify(orderPayload, null, 2));
  const response = await productApi.post('/product/api/orders/calculate/', orderPayload)
  return response.data
}

//Поиск GPT
export const GptSearch = async (description: string): Promise<string[]> => {
  try {
    const response = await productApi.post("/product/api/pid-extract/", {description}, {
    });

    const pidString = response.data?.pid
    if (pidString) {
      return JSON.parse(pidString);
    }
    return [];
  } catch (error) {
    console.error("Ошибка GPT запроса:", error);
    throw error;
  }
};
//Запрос расчета
export const getOrderById = async (id : string) => {
  try {
    const response = await productApi.get(`/product/orders/${id}`)
    return response.data
  } catch (error) {
    console.log('Ошибка:', error)
    throw error
  }
}
//Отправка на подтверждение
export const orderAccess = async (order_id : string) => {
  try {
    const response = await productApi.post('/product/orders/submit-for-approval/',{order_id})
    return response.data
  }  catch (error) {
    console.log('Ошибка:', error)
    throw error
  }
}
//Отмена отправки на подтверждение
export const cancelOrderAccess = async (order_id : string) => {
  try {
    const response = await productApi.post('/product/orders/cancel-submission/',{order_id})
    return response.data
  } catch (error) {
    console.log('Ошибка:', error)
    throw error
  }
}
//Поиск по job
export const getJobStatus = async (jobId: string, type: 'ebay' | 'itprice') => {
  const response = await productApi.get(`/product/sku/status/${jobId}/?type=${type}`);
  return response.data;
};

export const waitForJobResult = async (
  jobId: string,
  type: 'ebay' | 'itprice',
  maxAttempts = 20,
  interval = 2500
// eslint-disable-next-line @typescript-eslint/no-explicit-any
): Promise<any> => {
  let attempt = 0;

  while (attempt < maxAttempts) {
    const status = await getJobStatus(jobId, type);

    if (status.status === 'done' && status.result) {
      return status.result;
    }

    if (status.error) {
      throw new Error(`Ошибка парсинга (${type}): ${status.error}`);
    }

    await new Promise((resolve) => setTimeout(resolve, interval));
    attempt++;
  }

  throw new Error(`Время ожидания job_id ${jobId} (${type}) истекло`);
};

//Создание продукта
export const createProduct = async(data : INewProduct) => {
  try {
    console.log('Данные для создания продукта:', data);
    const response = await productApi.post("/product/manual-product-create/",data)
    return response.data
  } catch (error) {
    console.error("Ошибка при одобрении заказа:", error);
    message.error("Не удалось отправить заказ на одобрение");
    throw error;
  }
}

//Поиск неизвестного товара 
export const searchUnknownProduct = async (pid: string) => {
  try { 
    const response = await productApi.get(`/product/product-price-check/?sku=${pid}`)
    return response.data
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (error : any) {
    console.error("Ошибка при поиске неизвестного товара:", error);
    if (error.response?.status === 404) {
      return { exists: false };
    }
    message.error("Ошибка при поиске неизвестного товара");
    throw error;
  }
}
//Скидка
export const discount = async (orderId: string, comment: string) => {
  try {
    const response = await productApi.post("/product/discount-requests/", {
      order: orderId,
      comment,
    })
    return response.data
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (error: any) {
    if (error.response) {
      throw {
        status: error.response.status,
        data: error.response.data,
      }
    }
    throw error
  }
}

//Статус заказа
export const acceptOrder = async (orderId: string, status: "in_review" | "approved" | "rejected" | "pending" | "archived") => {
  try { 
    const response = await productApi.post(`/product/orders/${orderId}/status/`, {
      status,
    })

    return response.data
  } catch (error) {
    message.error("Ошибка при редактировании заказа")
    console.error("Ошибка при редактировании заказа:", error)
    throw error
  }
}

//Вывод данных заказа
export const editOrder = async (orderId: string) => {
  try {
    const response = await productApi.get(`/product/orders/${orderId}/`)
    return response.data
  } catch (error) {
    message.error("Ошибка при получении заказа")
    console.error("Ошибка при получении заказа:", error)
    throw error
  }
}

//Редактирование заказа
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const saveEditedOrder = async (orderId: string, orderPayload: any) => {
  try {
    const response = await productApi.put(
      `/product/orders/changes/${orderId}/`,
      orderPayload
    )
    message.success("Изменения успешно сохранены")
    return response.data
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (error: any) {
    console.error("Ошибка при сохранении изменений заказа:", error)

    if (error.response) {
      message.error(
        `Ошибка ${error.response.status}: ${error.response.data?.detail || "Не удалось сохранить заказ"}`
      )
    } else {
      message.error("Не удалось сохранить изменения. Попробуйте позже.")
    }

    throw error
  }
}

//Добавить в БД
export const addBase = async (jobId : string, source : "itprice" | "ebay") => {
  try {
    const response = await productApi.post('/product/apply-parsed-prices/', {
      job_id : jobId,
      source
    })
  return response.data
  } catch (error) {
    console.log('Ошибка запроса:',error)
  }
}