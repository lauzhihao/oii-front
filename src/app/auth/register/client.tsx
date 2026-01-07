'use client'
import { useState } from "react";
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import Link from "next/link"
import { loginWithEmailPassword } from "@/utils/Auth0/Login"
import { registerUser, registerWithSocialConnection } from "@/utils/Auth0/Register"
import { useForm } from "react-hook-form"
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { z } from "zod"
import { zodResolver } from "@hookform/resolvers/zod"
import { useRouter } from "next/navigation"
import styles from './RegisterPage.module.css'

// 创建表单验证模式
const registerSchema = z.object({
    name: z.string().min(2, { message: "Name must be at least 2 characters" }),
    email: z.email({ message: "Please enter a valid email address" }),
    password: z.string().min(8, { message: "Password must be at least 8 characters" }),
    agreeTerms: z.boolean().refine(val => val === true, { message: "You must agree to the terms and privacy policy" })
})

// 表单数据类型
type RegisterFormValues = z.infer<typeof registerSchema>

function RegisterClient() {
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState("")
    const [success, setSuccess] = useState("")
    const router = useRouter()
    // 初始化表单
    const form = useForm<RegisterFormValues>({
        resolver: zodResolver(registerSchema),
        defaultValues: {
            name: "",
            email: "",
            password: "",
            agreeTerms: false
        }
    })

    const handleCustomRegister = (values: RegisterFormValues) => {
        setLoading(true);
        setError("");
        setSuccess("");

        // 调试：打印注册参数
        console.log('注册参数:', {
            email: values.email,
            password: '***', // 不打印密码
            name: values.name,
            connection: 'Username-Password-Authentication'
        });

        // 使用 Auth0 的 registerUser 函数
        registerUser({
            email: values.email,
            password: values.password,
            name: values.name,
            given_name: values.name,
        }, (err, result) => {
            if (err) {
                let errorMessage = "Registration failed, please try again";
                
                // 处理常见的 Auth0 错误
                if (err.code === 'user_exists') {
                    errorMessage = "This email is already registered. Please try logging in instead.";
                } else if (err.code === 'invalid_password') {
                    errorMessage = "Password does not meet requirements. Please try a stronger password.";
                } else if (err.code === 'invalid_signup') {
                    errorMessage = "This email is already registered. Please try logging in instead.";
                } else if (err.description) {
                    errorMessage = err.description;
                }
                
                setError(errorMessage);
                setLoading(false);
                return;
            }

            // 注册成功
            console.log('Auth0 注册成功:', result);
            setSuccess("Registration successful!");
            
            // 可选：自动跳转到登录页面
            setTimeout(() => {
                router.push("/auth/login");
            }, 3000);
            
            setLoading(false);
        });
    }

    const handleSocialRegister = (connection: string) => {
        registerWithSocialConnection(connection);
    }

    return (
        <main className={styles['register-page']}>
            <div className={styles['register-page__container']}>
                <h1 className={styles['register-page__title']}>Welcome to Daoer</h1>
                <div className={styles['register-page__card']}>
                    <div className={styles['register-page__content']}>
                        {error && (
                            <div className={styles['register-page__error']}>
                                {error}
                            </div>
                        )}
                        {success && (
                            <div className={styles['register-page__success']}>
                                {success}
                            </div>
                        )}
                        <Form {...form}>
                            <form onSubmit={form.handleSubmit(handleCustomRegister)} className={styles['register-page__form']}>
                                <FormField
                                    control={form.control}
                                    name="name"
                                    render={({ field }) => (
                                        <FormItem className={styles['register-page__form-field']}>
                                            <FormLabel className={styles['register-page__form-label']}>Full Name</FormLabel>
                                            <FormControl>
                                                <input
                                                    placeholder=""
                                                    className={styles['register-page__input']}
                                                    {...field}
                                                />
                                            </FormControl>
                                            <FormMessage className={styles['register-page__form-message']} />
                                        </FormItem>
                                    )}
                                />

                                <FormField
                                    control={form.control}
                                    name="email"
                                    render={({ field }) => (
                                        <FormItem className={styles['register-page__form-field']}>
                                            <FormLabel className={styles['register-page__form-label']}>Email</FormLabel>
                                            <FormControl>
                                                <input
                                                    placeholder=""
                                                    type="email"
                                                    className={styles['register-page__input']}
                                                    {...field}
                                                />
                                            </FormControl>
                                            <FormMessage className={styles['register-page__form-message']} />
                                        </FormItem>
                                    )}
                                />

                                <FormField
                                    control={form.control}
                                    name="password"
                                    render={({ field }) => (
                                        <FormItem className={styles['register-page__form-field']}>
                                            <FormLabel className={styles['register-page__form-label']}>Password</FormLabel>
                                            <FormControl>
                                                <input
                                                    type="password"
                                                    placeholder=""
                                                    className={styles['register-page__input']}
                                                    {...field}
                                                />
                                            </FormControl>
                                            <FormMessage className={styles['register-page__form-message']} />
                                        </FormItem>
                                    )}
                                />

                                <Button
                                    type="submit"
                                    disabled={loading}
                                    className={styles['register-page__submit-button']}
                                >
                                    {loading ? "Creating account..." : "Create Account"}
                                </Button>

                                <FormField
                                    control={form.control}
                                    name="agreeTerms"
                                    render={({ field }) => (
                                        <FormItem className={styles['register-page__checkbox-field']}>
                                            <div className={styles['register-page__checkbox-wrapper']}>
                                                <FormControl>
                                                    <Checkbox
                                                        checked={field.value}
                                                        onCheckedChange={field.onChange}
                                                        className={styles['register-page__checkbox']}
                                                    />
                                                </FormControl>
                                                <FormLabel className={styles['register-page__checkbox-label']}>
                                                    I agree to{" "}
                                                    <Link href="/terms" className={styles['register-page__terms-link']}>
                                                        Terms of Service
                                                    </Link>{" "}
                                                    and{" "}
                                                    <Link href="/privacy" className={styles['register-page__terms-link']}>
                                                        Privacy Policy
                                                    </Link>
                                                </FormLabel>
                                            </div>
                                            <FormMessage className={styles['register-page__form-message']} />
                                        </FormItem>
                                    )}
                                />
                            </form>
                        </Form>

                        <div className={styles['register-page__divider']}>
                            <span className={styles['register-page__divider-text']}>or continue with</span>
                        </div>

                        <div className={styles['register-page__social-buttons']}>
                            <Button
                                variant="outline"
                                className={styles['register-page__social-button']}
                                onClick={() => handleSocialRegister('apple')}
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" className={styles['register-page__social-icon']} viewBox="0 0 24 24">
                                    <path d="M17.05 20.28c-.98.95-2.05.86-3.08.38-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.06-.39C2.79 15.37 3.51 7.01 9.07 6.54c1.38-.11 2.32.63 3.12.65.93-.06 1.8-.79 3.06-.67 1.3.13 2.26.53 2.93 1.4-2.3 1.45-1.77 4.68.64 5.65-1.06 2.77-3.02 4.85-4.76 6.71h-.01z" fill="black" />
                                    <path d="M12.03 6.3C11.78 4.58 13.19 3.1 14.9 3c.29 2.2-2.22 3.83-2.87 3.3z" fill="black" />
                                </svg>
                                Apple
                            </Button>
                            <Button
                                variant="outline"
                                className={styles['register-page__social-button']}
                                onClick={() => handleSocialRegister('google-oauth2')}
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" className={styles['register-page__social-icon']} viewBox="0 0 24 24">
                                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                                </svg>
                                Google
                            </Button>
                        </div>

                        <div className={styles['register-page__signin-text']}>
                            already have an account? <Link href="/auth/login" className={styles['register-page__signin-link']}>sign in</Link>
                        </div>
                    </div>
                </div>
                {/* <div className={styles['register-page__bg-icon-1']} />
                <div className={styles['register-page__bg-icon-2']} />
                <div className={styles['register-page__bg-icon-3']} />
                <div className={styles['register-page__bg-icon-4']} /> */}
            </div>
        </main>
    )
}

export default RegisterClient;