'use client'
import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Card, Typography, Form, Input, Button, message } from 'antd'
import { LockOutlined } from '@ant-design/icons'
import { resetPassword } from '@/app/services/api/auth'
 
export default function ResetPasswordConfirmPage() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const uid = searchParams.get('uid')
  const token = searchParams.get('token')
  const [loading, setLoading] = useState(false)

  const onFinish = async (values: { new_password: string; re_new_password: string }) => {
    if (!uid || !token) {
      message.error('Неверная или просроченная ссылка')
      return
    }

    if (values.new_password !== values.re_new_password) {
      message.error('Пароли не совпадают')
      return
    }

    setLoading(true)

    try {
      await resetPassword({
        uid,
        token,
        new_password: values.new_password,
        re_new_password: values.re_new_password,
      })

      message.success('Пароль успешно изменён! Перенаправление на вход...')
      setTimeout(() => {
        router.push('/')
      }, 2000)
    } catch (error) {
      console.error(error)
      message.error('Ошибка при сбросе пароля. Попробуйте снова.')
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
          Сброс пароля
        </Typography.Title>

        <Form layout="vertical" onFinish={onFinish}>
          <Form.Item
            name="new_password"
            label="Новый пароль"
            rules={[
              { required: true, message: 'Пожалуйста, введите новый пароль' },
              { min: 8, message: 'Пароль должен содержать минимум 8 символов' },
            ]}
            hasFeedback
          >
            <Input.Password prefix={<LockOutlined />} placeholder="Новый пароль" />
          </Form.Item>

          <Form.Item
            name="re_new_password"
            label="Повторите пароль"
            dependencies={['new_password']}
            hasFeedback
            rules={[
              { required: true, message: 'Пожалуйста, повторите пароль' },
              ({ getFieldValue }) => ({
                validator(_, value) {
                  if (!value || getFieldValue('new_password') === value) {
                    return Promise.resolve()
                  }
                  return Promise.reject(new Error('Пароли не совпадают'))
                },
              }),
            ]}
          >
            <Input.Password prefix={<LockOutlined />} placeholder="Повторите новый пароль" />
          </Form.Item>

          <Form.Item>
            <Button type="primary" htmlType="submit" block loading={loading}>
              Сбросить пароль
            </Button>
          </Form.Item>
        </Form>
      </Card>
    </div>
  )
}
