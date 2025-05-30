import { create } from 'zustand'
import { persist } from 'zustand/middleware'

// 颜色类型：纯色或印花
export type ColorType = 'solid' | 'pattern'

// 颈带款式类型
export type NeckStrapStyle = 'classic' | 'halter' | 'cross' | 'adjustable' | 'tie'

// 口袋模式类型
export type PocketMode = 'none' | 'single' | 'double' | 'multiple'

// 口袋配置接口
export interface PocketConfig {
  mode: PocketMode
  // 单口袋配置
  singlePocket?: {
    width: number // 口袋宽度 (cm)
    height: number // 口袋高度 (cm)
    positionX: number // 水平位置百分比 (0-100)
    positionY: number // 垂直位置百分比 (0-100)
  }
  // 双口袋配置
  doublePockets?: {
    leftPocket: {
      width: number // 左口袋宽度 (cm)
      height: number // 左口袋高度 (cm)
    }
    rightPocket: {
      width: number // 右口袋宽度 (cm)
      height: number // 右口袋高度 (cm)
    }
    spacing: number // 两个口袋之间的间距 (cm)
    positionY: number // 垂直位置百分比 (0-100)
  }
  // 多口袋配置
  multiplePockets?: {
    totalWidth: number // 所有口袋的总宽度 (cm)
    height: number // 口袋高度 (cm)
    count: number // 口袋数量 (2-6)
    positionY: number // 垂直位置百分比 (0-100)
  }
}

// 颈带款式配置
export interface NeckStrapConfig {
  style: NeckStrapStyle
  name: string
  description: string
}

// 预定义的颈带款式
export const NECK_STRAP_STYLES: Record<NeckStrapStyle, NeckStrapConfig> = {
  classic: {
    style: 'classic',
    name: '经典圆弧',
    description: '传统的圆弧形颈带，简洁优雅'
  },
  halter: {
    style: 'halter',
    name: '挂脖式',
    description: '绕颈式设计，时尚现代'
  },
  cross: {
    style: 'cross',
    name: '交叉式',
    description: '颈带和腰带为同一根带子，穿过腰部孔洞连接'
  },
  adjustable: {
    style: 'adjustable',
    name: '可调节',
    description: '带扣环的可调节颈带'
  },
  tie: {
    style: 'tie',
    name: '系带式',
    description: '可系结的柔软带子'
  }
}

// 纯色配置
export interface SolidColorConfig {
  type: 'solid'
  colorName: string // 颜色名称
  pantoneCode?: string // 潘通色号（可选）
  hexValue: string // 十六进制颜色值用于预览
}

// 印花配置
export interface PatternConfig {
  type: 'pattern'
  file: File | null // 矢量图案文件
  patternName: string // 图案名称
  repeatMode: 'tile' | 'stretch' | 'center' | 'custom' // 图案重复模式
  // 自定义模式的参数
  customSize?: number // 图案大小百分比 (10-100)
  customPositionX?: number // 水平位置百分比 (0-100)
  customPositionY?: number // 垂直位置百分比 (0-100)
}

// 围裙设计参数（按照指南规范）
export interface ApronDesign {
  // 基础尺寸参数
  topWidth: number // 围裙上沿宽度 (cm)
  bottomWidth: number // 围裙下沿宽度 (cm)
  totalHeight: number // 围裙整体高度 (cm)
  
  // 计算得出的参数（自动计算）
  waistHeight: number // 围裙腰部高度 = 整体高度 × 33%
  bottomHeight: number // 围裙下部高度 = 整体高度 - 腰部高度
  
  // 颜色规格
  colorConfig: SolidColorConfig | PatternConfig
  
  // 口袋配置
  pocketConfig: PocketConfig
  
  // 绑带参数（使用模板默认值）
  neckStrap: number
  waistStrap: number
  
  // 颈带款式
  neckStrapStyle: NeckStrapStyle
}

interface ApronDesignStore {
  design: ApronDesign
  updateDesign: (updates: Partial<Omit<ApronDesign, 'waistHeight' | 'bottomHeight'>>) => void
  updateColorConfig: (colorConfig: SolidColorConfig | PatternConfig) => void
  updatePocketConfig: (pocketConfig: PocketConfig) => void
  resetDesign: () => void
  // 计算方法
  calculateDimensions: () => void
  // 临时存储文件（不持久化）
  tempFile: File | null
  setTempFile: (file: File | null) => void
}

const defaultDesign: ApronDesign = {
  topWidth: 45,
  bottomWidth: 60,
  totalHeight: 70,
  waistHeight: 23.1, // 70 × 33% = 23.1
  bottomHeight: 46.9, // 70 - 23.1 = 46.9
  colorConfig: {
    type: 'solid',
    colorName: '珊瑚红',
    hexValue: '#FF6B6B'
  },
  pocketConfig: {
    mode: 'none'
  },
  neckStrap: 50,
  waistStrap: 80,
  neckStrapStyle: 'classic'
}

export const useApronDesignStore = create<ApronDesignStore>()(
  persist(
    (set, get) => ({
      design: defaultDesign,
      tempFile: null,
      
      updateDesign: (updates) =>
        set((state) => {
          const newDesign = { ...state.design, ...updates }
          
          // 自动重新计算尺寸
          if (updates.totalHeight !== undefined) {
            const newWaistHeight = Math.round(newDesign.totalHeight * 0.33 * 10) / 10
            const newBottomHeight = Math.round((newDesign.totalHeight - newWaistHeight) * 10) / 10
            newDesign.waistHeight = newWaistHeight
            newDesign.bottomHeight = newBottomHeight
          }
          
          return { design: newDesign }
        }),
        
      updateColorConfig: (colorConfig) =>
        set((state) => ({
          design: { ...state.design, colorConfig }
        })),
        
      updatePocketConfig: (pocketConfig) =>
        set((state) => ({
          design: { ...state.design, pocketConfig }
        })),
        
      calculateDimensions: () =>
        set((state) => {
          const newWaistHeight = Math.round(state.design.totalHeight * 0.33 * 10) / 10
          const newBottomHeight = Math.round((state.design.totalHeight - newWaistHeight) * 10) / 10
          return {
            design: {
              ...state.design,
              waistHeight: newWaistHeight,
              bottomHeight: newBottomHeight
            }
          }
        }),
        
      setTempFile: (file) =>
        set({ tempFile: file }),
        
      resetDesign: () =>
        set({ design: defaultDesign, tempFile: null })
    }),
    {
      name: 'apron-design-storage-v6', // 更改存储键名以清除旧数据，支持口袋配置
      partialize: (state) => ({
        design: {
          ...state.design,
          // 排除File对象，因为它们不能被序列化
          colorConfig: state.design.colorConfig.type === 'pattern' 
            ? {
                ...state.design.colorConfig,
                file: null // 不保存文件对象
              }
            : state.design.colorConfig
        }
        // tempFile不会被持久化
      })
    }
  )
) 