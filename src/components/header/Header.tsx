'use client'
import styles from './Header.module.css';
import { cn } from "@/lib/utils";
import Link from 'next/link';
import { useEffect, useState } from 'react';
import UserInteractButton from '@/components/button/user-interaction/UserInteractButton';

/**
 * Header组件的Props
 * @param enableScrollOpacity 是否启用滚动透明度
 * @param className 组件的类名
 * @param componentOnLeft 图标左侧需要放置的组件
 * @returns Header组件
 */
interface HeaderProps {
    enableScrollOpacity?: boolean,
    className?: string,
    componentOnLeft?: React.ReactNode,
    componentOnRight?: React.ReactNode,
}

function Header({
    enableScrollOpacity = true,
    className,
    componentOnLeft,
    componentOnRight,
}: HeaderProps) {
    const [scrollOpacity, setScrollOpacity] = useState(0);

    useEffect(() => {
        const mainLayoutElement = document.getElementById('app-sidebar-content-no-sidebar');

        if (!mainLayoutElement || !enableScrollOpacity) return;

        const handleScroll = () => {
            const scrollTop = mainLayoutElement.scrollTop;
            // 滚动距离达到100px时透明度达到最大值100%
            const maxScrollDistance = 60;
            const opacity = Math.min(scrollTop / maxScrollDistance, 1) * 1;
            setScrollOpacity(opacity);
        };

        mainLayoutElement.addEventListener('scroll', handleScroll);

        // 清理函数
        return () => {
            mainLayoutElement.removeEventListener('scroll', handleScroll);
        };
    }, []);

    return (
        <header
            className={cn(
                'header',
                styles.header,
                className,
            )}
            style={
                enableScrollOpacity ? {
                    backgroundColor: `color-mix(in srgb, #A3DFFF ${scrollOpacity * 100}%, transparent)`
                } : undefined
            }
        >
            <div className={
                styles.header_left
            }>
                {componentOnLeft ?? null}
                <Link className={cn(
                    'w-fit h-fit',
                    styles.header_logo_link
                )} href={'/'}
                >
                    <div className={cn(
                        'header-logo',
                        styles.header_logo,
                    )}>
                        {/* logo的svg */}
                        <svg xmlns="http://www.w3.org/2000/svg" width="37" height="38" viewBox="0 0 37 38" fill="none">
                            <path d="M2.27602 20.0312C1.82746 22.3214 1.86773 25.2559 2.83079 27.9424C3.79385 30.6288 8.21544 35.9397 18.6067 35.1595C28.9979 34.3793 33.5282 25.9945 34.6603 20.0775" stroke="#20201E" strokeWidth="4" strokeLinecap="round" />
                            <path d="M11 15.5L10 21.5" stroke="#20201E" strokeWidth="4" strokeLinecap="round" />
                            <path d="M18.6367 15.5L17.6367 21.5" stroke="#20201E" strokeWidth="4" strokeLinecap="round" />
                            <path d="M30 2.5L26 21.5" stroke="#20201E" strokeWidth="4" strokeLinecap="round" />
                            <path d="M11.2031 16.2891L11 18" stroke="white" strokeWidth="1.6" strokeLinecap="round" />
                            <path d="M18.7422 16.5L18.5391 18.2109" stroke="white" strokeWidth="1.6" strokeLinecap="round" />
                        </svg>
                        <span
                            className={styles.header_logo_text}
                        >
                            Daoer
                        </span>
                    </div>
                </Link>
            </div>
            <div className={cn(
                'header_interaction',
                styles.header_interaction,
            )}>
                {componentOnRight}
                <UserInteractButton />
            </div>
        </header >
    )
}

export default Header;