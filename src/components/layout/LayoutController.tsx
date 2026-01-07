'use client'

import { useState, useEffect, useCallback } from "react"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils";
import { SidebarTabEnum } from "@/components/sidebar/type/sidebar-tab-enum";
import Header from "@/components/header/Header";
import {
    SidebarProvider,
} from "@/components/ui/sidebar";
import { AppSidebar, Sidebar_Sheet } from "../sidebar";
import { useCreateStore } from "@/components/page-create/stores/create-store";
import { MessageSquare } from 'lucide-react';

/**
 * 控制页面中Header与Sidebar是否显示的组件
 * 1. 控制Header的显示
 * 2. 控制sidebar的显示与项目的选中
 */

export default function LayoutController({ children }: { children: React.ReactNode }) {

    const [isShowSidebar, setIsShowSidebar] = useState(false);
    const [isShowHeader, setIsShowHeader] = useState(true);

    const [sidebarActiveTab, setSidebarActiveTab] = useState<string>(SidebarTabEnum.None);

    const pathname = usePathname();

    // 聊天Sheet状态
    const toggleChat = useCreateStore((state) => state.toggleChat);

    // 判断是否为首页
    const isHomePage = pathname === '/';

    /**
     * 根据当前路径设置对应的sidebar tab
     */
    const updateSidebarTabFromPathname = useCallback(() => {

        if (pathname.startsWith('/detail/live/')) {
            setIsShowHeader(false);
        } else {
            setIsShowHeader(true);
        }

        if (pathname.startsWith('/community/')) {
            const communityTitle = pathname.split('/')[2];
            setSidebarActiveTab(communityTitle);
            setIsShowSidebar(true);
            return;
        }

        // 根据pathname设置对应的sidebar tab
        switch (pathname) {
            // 首页
            case '/':
                setIsShowSidebar(true);
                if (sidebarActiveTab === SidebarTabEnum.None) {
                    setSidebarActiveTab(SidebarTabEnum.Home)
                }
                break;
            case '/auth/login':
                setIsShowHeader(false);
                setIsShowSidebar(false);
                break;
            case '/auth/register':
                setIsShowHeader(false);
                setIsShowSidebar(false);
                break;
            default:
                // 其他 - 不显示
                setIsShowSidebar(true);
                setSidebarActiveTab(SidebarTabEnum.None);
                break;
        }

    }, [pathname]);

    // 监听路径变化
    useEffect(() => {
        updateSidebarTabFromPathname();
    }, [updateSidebarTabFromPathname]);

    return (
        <SidebarProvider
            className={cn(
                'layout-controller',
                'layout-controller--full-size',
                'w-full h-full',
                'flex flex-col',
                'overflow-hidden'
            )}
        >
            {isShowHeader && <Header
                enableScrollOpacity={false}
                componentOnLeft={(
                    <Sidebar_Sheet
                        activeTab={sidebarActiveTab}
                        setActiveTab={setSidebarActiveTab}
                    />
                )}
                componentOnRight={isHomePage ? (
                    <button
                        onClick={toggleChat}
                        className={cn(
                            'flex items-center justify-center',
                            'w-9 h-9 rounded-lg',
                            'bg-white/90 hover:bg-white',
                            'border border-black/8',
                            'shadow-sm hover:shadow-md',
                            'cursor-pointer transition-all duration-200',
                            'hover:scale-105'
                        )}
                    >
                        <MessageSquare className="size-4" />
                    </button>
                ) : undefined}
            />}
            <div
                className={cn(
                    'layout-controller__content',
                    'w-full flex-1 overflow-hidden'
                )}
            >
                {isShowSidebar ?
                    (<AppSidebar
                        activeTab={sidebarActiveTab}
                        setActiveTab={setSidebarActiveTab}
                        enableMobileBar={false}
                        outsideSidebarProvider={true}
                    >
                        {children}
                    </AppSidebar>)
                    : <div
                        className="w-full h-full overflow-auto sc"
                        id={'app-sidebar-content-no-sidebar'}
                        style={{
                            scrollbarWidth: 'thin',
                            scrollBehavior: 'smooth',
                        }}
                    >
                        {children}
                    </div>
                }
            </div>
        </SidebarProvider>
    )
}