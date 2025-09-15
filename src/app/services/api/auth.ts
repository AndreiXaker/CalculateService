import axios from 'axios';
import { ILogin,IResetPassword } from "@/app/types/user.interface";

export const login = async (data: ILogin) => {
  try {
    const response = await axios.post(
      'https://calculate-bsshop.ru/users/auth/jwt/create/',
      data,
    );
    return response.data;
  } catch (error: unknown) {
    if (axios.isAxiosError(error)) {
      throw error;
    }
    throw error;
  }
};

export const resetPassword = async (data: IResetPassword) => {
   try {
    const response = await axios.post('https://calculate-bsshop.ru/users/auth/users/reset_password_confirm/', data);
    return response.data; 
  } catch (error: unknown) {
    if (axios.isAxiosError(error)) {
      throw error.response?.data || error;
    }
    throw error;
  }
}
