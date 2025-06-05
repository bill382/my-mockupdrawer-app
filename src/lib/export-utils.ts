import JSZip from 'jszip'
import { saveAs } from 'file-saver'
import type { ApronDesign, SolidColorConfig, PatternConfig } from '@/store/apron-design'

export class ExportUtils {
  static async exportSVG(svgContent: string, filename: string = 'apron-design.svg') {
    const blob = new Blob([svgContent], { type: 'image/svg+xml' })
    saveAs(blob, filename)
  }

  static async exportDesignPackage(svgContent: string, design: ApronDesign, filename: string = 'apron-design-package.zip') {
    const zip = new JSZip()
    
    // 添加SVG文件
    zip.file('design.svg', svgContent)
    
    // 添加设计参数JSON文件
    const designData = {
      ...design,
      exportDate: new Date().toISOString(),
      version: '2.0',
      specification: 'Professional Apron Design Standard'
    }
    zip.file('design-parameters.json', JSON.stringify(designData, null, 2))
    
    // 生成颜色规格说明
    const getColorSpecification = (colorConfig: SolidColorConfig | PatternConfig): string => {
      if (colorConfig.type === 'solid') {
        const solid = colorConfig as SolidColorConfig
        let spec = `颜色类型: 纯色
颜色名称: ${solid.colorName}
预览色值: ${solid.hexValue}`
        
        if (solid.pantoneCode) {
          spec += `
潘通色号: ${solid.pantoneCode}`
        }
        return spec
      } else {
        const pattern = colorConfig as PatternConfig
        return `颜色类型: 印花
图案名称: ${pattern.patternName}
重复模式: ${pattern.repeatMode}${pattern.file ? `
图案文件: ${pattern.file.name} (${pattern.file.type})` : ''}`
      }
    }
    
    // 添加说明文件
    const readme = `围裙设计稿说明
================

基础尺寸参数：
- 围裙上沿宽度: ${design.topWidth}CM
- 围裙下沿宽度: ${design.bottomWidth}CM  
- 围裙整体高度: ${design.totalHeight}CM

自动计算尺寸：
- 围裙上部高度: ${design.waistHeight}CM (整体高度 × 33%)
- 围裙下部高度: ${design.bottomHeight}CM (整体高度 - 上部高度)

绑带参数：
- 颈带长度: ${design.neckStrap}CM
- 腰带长度: ${design.waistStrap}CM

颜色规格：
${getColorSpecification(design.colorConfig)}

设计规范：
- 围裙形状: 梯形(上部) + 矩形(下摆)
- 标注单位: CM/INCH双语显示
- 尺寸精度: 小数点后1位
- 符合工业标准设计稿要求

文件说明：
- design.svg: 可编辑的矢量设计稿
- design-parameters.json: 设计参数数据
- README.txt: 本说明文件

导出时间: ${new Date().toLocaleString('zh-CN')}
生成器版本: 2.0 (Professional Standard)
`
    
    zip.file('README.txt', readme)
    
    // 如果有印花文件，也添加到ZIP中
    if (design.colorConfig.type === 'pattern') {
      const patternConfig = design.colorConfig as PatternConfig
      if (patternConfig.file) {
        zip.file(`pattern-files/${patternConfig.file.name}`, patternConfig.file)
      }
    }
    
    // 生成并下载ZIP文件
    const content = await zip.generateAsync({ type: 'blob' })
    saveAs(content, filename)
  }

  static async exportPNG(svgContent: string, filename: string = 'apron-design.png', scale: number = 2) {
    return new Promise<void>((resolve, reject) => {
      // 创建临时SVG元素
      const svgBlob = new Blob([svgContent], { type: 'image/svg+xml' })
      const url = URL.createObjectURL(svgBlob)
      
      const img = new Image()
      img.onload = () => {
        // 创建canvas
        const canvas = document.createElement('canvas')
        const ctx = canvas.getContext('2d')
        
        if (!ctx) {
          reject(new Error('无法创建canvas上下文'))
          return
        }
        
        // 设置canvas尺寸
        canvas.width = img.width * scale
        canvas.height = img.height * scale
        
        // 设置白色背景
        ctx.fillStyle = '#ffffff'
        ctx.fillRect(0, 0, canvas.width, canvas.height)
        
        // 绘制SVG
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
        
        // 转换为PNG并下载
        canvas.toBlob((blob) => {
          if (blob) {
            saveAs(blob, filename)
            resolve()
          } else {
            reject(new Error('PNG转换失败'))
          }
        }, 'image/png')
        
        // 清理
        URL.revokeObjectURL(url)
      }
      
      img.onerror = () => {
        URL.revokeObjectURL(url)
        reject(new Error('SVG加载失败'))
      }
      
      img.src = url
    })
  }

  static getDesignSummary(design: ApronDesign): string {
    const cmToInch = (cm: number) => (cm * 0.393701).toFixed(1)
    
    const colorInfo = design.colorConfig.type === 'solid' 
      ? `纯色: ${(design.colorConfig as SolidColorConfig).colorName}`
      : `印花: ${(design.colorConfig as PatternConfig).patternName}`
    
    return `围裙设计概要：
尺寸规格：
- 上沿×下沿×高度: ${design.topWidth}×${design.bottomWidth}×${design.totalHeight}CM
- 英制单位: ${cmToInch(design.topWidth)}×${cmToInch(design.bottomWidth)}×${cmToInch(design.totalHeight)}INCH
- 上部高度: ${design.waistHeight}CM (${cmToInch(design.waistHeight)}INCH)
- 下部高度: ${design.bottomHeight}CM (${cmToInch(design.bottomHeight)}INCH)

绑带规格：
- 颈带: ${design.neckStrap}CM (${cmToInch(design.neckStrap)}INCH)
- 腰带: ${design.waistStrap}CM (${cmToInch(design.waistStrap)}INCH)

颜色规格：
- ${colorInfo}`
  }
} 