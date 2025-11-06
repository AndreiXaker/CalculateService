'use client'

import { useState } from 'react'
import { Form, Input, Button, Card, Typography, message } from 'antd'
import axios from 'axios'
import { useRouter } from 'next/navigation'

export default function ResetPasswordPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  const onFinish = async (values: { email: string }) => {
    setLoading(true)
    try {
      await axios.post('https://calc.net-eng.ru/users/auth/users/reset_password/', {
        email: values.email,
      })
      message.success('Ссылка для восстановления пароля отправлена на ваш email')
      router.push('/') 
    } catch (error) {
      console.error(error)
      message.error('Ошибка при отправке. Проверьте email и попробуйте снова.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      style={{
        display: 'flex',
        minHeight: '100vh',
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#f0f2f5',
      }}
    >
      <Card style={{ width: 400 }}>
        <Typography.Title level={3} style={{ textAlign: 'center' }}>
          Восстановление пароля
        </Typography.Title>

        <Form name="reset-password" layout="vertical" onFinish={onFinish}>
          <Form.Item
            label="Email"
            name="email"
            rules={[
              { required: true, message: 'Пожалуйста, введите email' },
              { type: 'email', message: 'Введите корректный email' },
            ]}
          >
            <Input placeholder="email@example.com" />
          </Form.Item>

          <Form.Item>
            <Button type="primary" htmlType="submit" block loading={loading}>
              Отправить ссылку
            </Button>
          </Form.Item>
        </Form>
      </Card>
    </div>
  )
}
 
