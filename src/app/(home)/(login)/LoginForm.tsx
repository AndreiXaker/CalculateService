'use client'
import { Input, Button, Card,  Form, Typography, message } from 'antd';
import { LockOutlined, MailOutlined } from '@ant-design/icons';
import Cookies from 'js-cookie';
import { useRouter } from 'next/navigation';
import { login } from '@/app/services/api/auth';
import { ILogin } from '@/app/types/user.interface';
export default function LoginForm() {
    const router = useRouter();
    const [form] = Form.useForm()
  

    
    const handleLogin = async (values: ILogin) => {
    try {
      const res = await login(values);
    
    Cookies.set('access_token', res.access, {
      expires: 1, 
      secure: true,
      sameSite: 'Lax',
    });

    message.success('Успешный вход в систему');
    router.push('/main');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error : any) {
      if (error?.response?.status === 401) {
        form.setFields([
          {
            name: 'email',
            errors: ['Пользователь не найден'],
          },
        ]);
      } else {
        message.error('Ошибка входа в систему. Попробуйте позже.');
      }
    }
  };

  return (
    <div style={{
      display: 'flex',
      minHeight: '100vh',
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: '#f0f2f5'
    }}>
      <Card
        style={{ width: 400 }}
      >
        <Typography.Title level={3} style={{ textAlign: 'center' }}>Вход в систему</Typography.Title>
        

        <Form
          form={form}
          name="login-form"
          layout="vertical"
          style={{ marginTop: 20 }}
          initialValues={{ email: '', password: '' }}
          onFinish={handleLogin}
        >
          <Form.Item
            label="Email"
            name="email"
            rules={[{required: true, message: 'Пожалуйста, введите Email' }]}
          >
            <Input
              prefix={<MailOutlined />}
              placeholder="email@example.com"
            />
          </Form.Item>

          <Form.Item
            label="Пароль"
            name="password"
            rules={[{required: true, message: 'Пожалуйста, введите пароль' }]}
          >
            <Input.Password
              prefix={<LockOutlined />}
              placeholder="••••••••"
            />
          </Form.Item>

          <Form.Item>
            <Button  type="primary" htmlType="submit" block>
              Войти
            </Button>
          </Form.Item>

          <Form.Item>
          <a onClick={() => router.push('/reset-password')} className="text-sm text-blue-500 hover:underline">
            Забыли пароль?
          </a>
          </Form.Item>
        </Form>

      </Card>
    </div>
  );
}
