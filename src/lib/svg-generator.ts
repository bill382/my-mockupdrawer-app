import { SVG } from '@svgdotjs/svg.js'
import type { ApronDesign, SolidColorConfig, PatternConfig, NeckStrapStyle, PocketConfig } from '@/store/apron-design'

// 单位转换：CM 转 INCH
const cmToInch = (cm: number): number => cm * 0.393701

// 格式化尺寸显示（双语）
const formatDimension = (cm: number): string => {
  const inch = cmToInch(cm)
  return `${cm}CM/${inch.toFixed(1)}INCH`
}

export class ApronSVGGenerator {
  private svg: any
  private design: ApronDesign
  private tempFile: File | null
  private scale: number = 4 // 缩放比例，1cm = 4px

  constructor(design: ApronDesign, tempFile: File | null = null) {
    this.design = design
    this.tempFile = tempFile
  }

  async generate(): Promise<string> {
    // 计算SVG画布尺寸（包含标注空间）
    const maxWidth = Math.max(this.design.topWidth, this.design.bottomWidth)
    const canvasWidth = (maxWidth + 60) * this.scale
    const canvasHeight = (this.design.totalHeight + 80) * this.scale

    // 创建SVG画布 - 在浏览器环境中需要创建临时容器
    if (typeof window === 'undefined') {
      // 服务端渲染时返回空字符串
      return ''
    }
    
    // 创建临时容器
    const container = document.createElement('div')
    this.svg = SVG().addTo(container).size(canvasWidth, canvasHeight)
    
    // 设置背景
    this.svg.rect(canvasWidth, canvasHeight).fill('#ffffff')

    // 绘制围裙主体（按照指南：梯形+矩形）
    await this.drawApronBody()
    
    // 绘制绑带
    this.drawStraps()
    
    // 绘制口袋（参考样本图）
    this.drawPocket()
    
    // 添加尺寸标注
    this.addDimensions()
    
    // 添加颜色规格标注
    this.addColorSpecification()
    
    // 添加标题
    this.addTitle()

    return this.svg.svg()
  }

  private async drawApronBody() {
    const startX = 30 * this.scale
    const startY = 40 * this.scale
    
    // 按照指南计算的尺寸
    const topWidth = this.design.topWidth * this.scale
    const bottomWidth = this.design.bottomWidth * this.scale
    const waistHeight = this.design.waistHeight * this.scale
    const bottomHeight = this.design.bottomHeight * this.scale
    
    // 居中对齐
    const topStartX = startX + (bottomWidth - topWidth) / 2
    const bottomStartX = startX

    // 绘制完整的围裙形状（一个连续的路径）
    const apronPath = `
      M ${topStartX} ${startY}
      L ${topStartX + topWidth} ${startY}
      Q ${topStartX + topWidth + (bottomWidth - topWidth) * 0.1} ${startY + waistHeight * 0.8} ${bottomStartX + bottomWidth} ${startY + waistHeight}
      L ${bottomStartX + bottomWidth} ${startY + waistHeight + bottomHeight}
      L ${bottomStartX} ${startY + waistHeight + bottomHeight}
      L ${bottomStartX} ${startY + waistHeight}
      Q ${topStartX - (bottomWidth - topWidth) * 0.1} ${startY + waistHeight * 0.8} ${topStartX} ${startY}
      Z
    `

    // 获取填充颜色
    const fillColor = this.getFillColor()

    // 绘制围裙主体
    const apronShape = this.svg.path(apronPath)
      .fill(fillColor)
      .stroke('#333333')
      .attr('stroke-width', 2)

    // 如果是印花，应用图案
    if (this.design.colorConfig.type === 'pattern') {
      await this.applyPatternToApron(apronShape, startX, startY, bottomWidth, waistHeight + bottomHeight)
    }
  }

  private getFillColor(): string {
    if (this.design.colorConfig.type === 'solid') {
      return (this.design.colorConfig as SolidColorConfig).hexValue
    } else {
      // 印花背景使用浅灰色
      return '#f5f5f5'
    }
  }

  private async applyPatternToApron(apronShape: any, x: number, y: number, width: number, height: number) {
    const patternConfig = this.design.colorConfig as PatternConfig
    
    // 优先使用tempFile，如果没有则使用colorConfig中的file
    const fileToUse = this.tempFile || patternConfig.file
    
    console.log('应用图案到围裙:', { 
      hasFile: !!fileToUse, 
      hasTempFile: !!this.tempFile,
      hasConfigFile: !!patternConfig.file,
      patternName: patternConfig.patternName,
      repeatMode: patternConfig.repeatMode 
    })
    
    if (fileToUse) {
      // 如果有文件，创建基于文件的图案
      const patternId = await this.createPatternFromFile(
        fileToUse, 
        patternConfig.repeatMode, 
        width, 
        height,
        patternConfig.customSize,
        patternConfig.customPositionX,
        patternConfig.customPositionY
      )
      console.log('创建的文件图案ID:', patternId)
      
      if (patternId) {
        console.log('应用图案到围裙，URL:', `url(#${patternId})`)
        apronShape.fill(`url(#${patternId})`)
        console.log('图案已应用到围裙，当前fill属性:', apronShape.attr('fill'))
        
        // 验证pattern是否存在于DOM中
        setTimeout(() => {
          const patternElement = document.getElementById(patternId)
          console.log('Pattern元素是否存在于DOM:', !!patternElement)
          if (patternElement) {
            console.log('Pattern元素内容:', patternElement.outerHTML.substring(0, 200))
          }
        }, 100)
      } else {
        console.log('文件图案创建失败，显示文字说明')
        this.addPatternText(x, y, width, height, patternConfig)
      }
    } else {
      // 没有文件时显示文字说明
      console.log('没有文件，显示文字说明')
      this.addPatternText(x, y, width, height, patternConfig)
    }
  }

  private async createPatternFromFile(file: File, repeatMode: string, width: number, height: number, customSize?: number, customPositionX?: number, customPositionY?: number): Promise<string | null> {
    // 安全检查文件对象
    if (!file || !file.type) {
      console.error('文件对象无效:', { file, type: file?.type })
      return null
    }

    const fileType = file.type.toLowerCase()
    const patternId = `pattern-${Date.now()}`
    
    console.log('开始处理文件:', { 
      fileName: file.name, 
      fileType, 
      fileSize: file.size,
      patternId,
      repeatMode,
      customSize,
      customPositionX,
      customPositionY
    })
    
    try {
      if (fileType.includes('svg')) {
        console.log('处理SVG文件...')
        // 处理SVG文件
        const svgContent = await this.readFileAsText(file)
        console.log('SVG内容读取完成:', { contentLength: svgContent?.length })
        if (svgContent) {
          const result = this.createSVGPattern(svgContent, patternId, repeatMode, width, height, customSize, customPositionX, customPositionY)
          console.log('SVG pattern创建结果:', result)
          return result
        } else {
          console.error('SVG内容为空')
        }
      } else if (fileType.includes('image')) {
        console.log('处理图片文件...')
        // 处理图片文件
        const imageUrl = await this.readFileAsDataURL(file)
        console.log('图片URL读取完成:', { urlLength: imageUrl?.length })
        if (imageUrl) {
          const result = this.createImagePattern(imageUrl, patternId, repeatMode, width, height, customSize, customPositionX, customPositionY)
          console.log('图片pattern创建结果:', result)
          return result
        } else {
          console.error('图片URL为空')
        }
      } else if (fileType.includes('pdf')) {
        console.log('处理PDF文件...')
        // 处理PDF文件 - 转换为图片
        const imageUrl = await this.convertPDFToImage(file)
        console.log('PDF转图片完成:', { urlLength: imageUrl?.length })
        if (imageUrl) {
          const result = this.createImagePattern(imageUrl, patternId, repeatMode, width, height, customSize, customPositionX, customPositionY)
          console.log('PDF pattern创建结果:', result)
          return result
        } else {
          console.error('PDF转换失败')
        }
      } else {
        console.error('不支持的文件类型:', fileType)
      }
    } catch (error) {
      console.error('创建图案过程中出错:', error)
    }
    
    console.log('图案创建失败，返回null')
    return null
  }

  private createSVGPattern(svgContent: string, patternId: string, repeatMode: string, width: number, height: number, customSize?: number, customPositionX?: number, customPositionY?: number): string {
    try {
      console.log('开始创建SVG图案:', { patternId, repeatMode, svgContentLength: svgContent.length })
      
      // 根据重复模式设置pattern尺寸和变换
      let patternWidth, patternHeight, transform, opacity
      switch (repeatMode) {
        case 'tile':
          patternWidth = patternHeight = 100
          transform = 'scale(0.3) translate(20, 20)'
          opacity = '0.7'
          break
        case 'stretch':
          patternWidth = width
          patternHeight = height
          transform = `scale(${width/300}, ${height/300})`
          opacity = '0.8'
          break
        case 'center':
          // 居中模式：pattern覆盖整个区域，SVG内容居中显示
          patternWidth = width
          patternHeight = height
          // 计算合适的缩放和居中位置
          const centerTargetSize = Math.min(width, height) * 0.3 // 目标大小为区域的30%
          const centerScale = centerTargetSize / 200 // 假设原始SVG大约200px
          const centerTranslateX = (width - 200 * centerScale) / 2
          const centerTranslateY = (height - 200 * centerScale) / 2
          transform = `translate(${centerTranslateX}, ${centerTranslateY}) scale(${centerScale})`
          opacity = '0.8'
          break
        case 'custom':
          // 自定义模式：用户控制大小和位置
          patternWidth = width
          patternHeight = height
          // 使用自定义参数或默认值
          const sizePercent = (customSize || 30) / 100
          const positionXPercent = (customPositionX || 50) / 100
          const positionYPercent = (customPositionY || 50) / 100
          
          // 计算缩放和位置
          const customTargetSize = Math.min(width, height) * sizePercent
          const customScale = customTargetSize / 200 // 假设原始SVG大约200px
          const maxTranslateX = width - 200 * customScale
          const maxTranslateY = height - 200 * customScale
          const customTranslateX = Math.max(0, maxTranslateX * positionXPercent)
          const customTranslateY = Math.max(0, maxTranslateY * positionYPercent)
          
          transform = `translate(${customTranslateX}, ${customTranslateY}) scale(${customScale})`
          opacity = '0.8'
          break
        default:
          patternWidth = patternHeight = 100
          transform = 'scale(0.3) translate(20, 20)'
          opacity = '0.7'
      }
      
      console.log('Pattern尺寸设置:', { patternWidth, patternHeight, transform, opacity })

      // 直接创建原生SVG pattern元素
      const svgNode = this.svg.node
      const defs = svgNode.querySelector('defs') || svgNode.appendChild(document.createElementNS('http://www.w3.org/2000/svg', 'defs'))
      
      // 创建pattern元素
      const pattern = document.createElementNS('http://www.w3.org/2000/svg', 'pattern')
      pattern.setAttribute('id', patternId)
      pattern.setAttribute('x', '0')
      pattern.setAttribute('y', '0')
      pattern.setAttribute('width', patternWidth.toString())
      pattern.setAttribute('height', patternHeight.toString())
      pattern.setAttribute('patternUnits', 'userSpaceOnUse')
      
      // 对于居中和自定义模式，添加透明背景
      if (repeatMode === 'center' || repeatMode === 'custom') {
        const bgRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect')
        bgRect.setAttribute('width', patternWidth.toString())
        bgRect.setAttribute('height', patternHeight.toString())
        bgRect.setAttribute('fill', 'transparent')
        pattern.appendChild(bgRect)
      }
      
      // 尝试解析并添加SVG内容
      try {
        const parser = new DOMParser()
        const svgDoc = parser.parseFromString(svgContent, 'image/svg+xml')
        const svgElement = svgDoc.querySelector('svg')
        
        if (svgElement && svgElement.innerHTML.trim()) {
          console.log('SVG元素解析成功，添加内容')
          
          // 创建一个组来包含SVG内容
          const group = document.createElementNS('http://www.w3.org/2000/svg', 'g')
          group.setAttribute('transform', transform)
          group.setAttribute('opacity', opacity)
          
          // 复制SVG内容
          const children = Array.from(svgElement.children)
          children.forEach(child => {
            const clonedChild = child.cloneNode(true) as Element
            group.appendChild(clonedChild)
          })
          
          pattern.appendChild(group)
          console.log('SVG内容添加成功')
        }
      } catch (error) {
        console.error('添加SVG内容失败:', error)
      }
      
      // 将pattern添加到defs中
      defs.appendChild(pattern)
      
      console.log('Pattern创建完成并添加到DOM:', patternId)
      console.log('Pattern元素:', pattern.outerHTML.substring(0, 300))
      
      return patternId
    } catch (error) {
      console.error('创建SVG图案失败:', error)
      return ''
    }
  }

  private createImagePattern(imageUrl: string, patternId: string, repeatMode: string, width: number, height: number, customSize?: number, customPositionX?: number, customPositionY?: number): string {
    try {
      // 根据重复模式设置图案
      let patternWidth, patternHeight, imageX, imageY, imageWidth, imageHeight
      
      switch (repeatMode) {
        case 'tile':
          patternWidth = patternHeight = 100
          imageX = imageY = 0
          imageWidth = imageHeight = 100
          break
        case 'stretch':
          patternWidth = width
          patternHeight = height
          imageX = imageY = 0
          imageWidth = width
          imageHeight = height
          break
        case 'center':
          // 居中模式：pattern覆盖整个区域，图片居中显示
          patternWidth = width
          patternHeight = height
          // 图片尺寸设为区域的30%，保持合适的大小，并居中
          const maxImageSize = Math.min(width, height) * 0.3
          imageWidth = maxImageSize
          imageHeight = maxImageSize
          imageX = (width - imageWidth) / 2
          imageY = (height - imageHeight) / 2
          break
        case 'custom':
          // 自定义模式：用户控制大小和位置
          patternWidth = width
          patternHeight = height
          // 使用自定义参数或默认值
          const sizePercent = (customSize || 30) / 100
          const positionXPercent = (customPositionX || 50) / 100
          const positionYPercent = (customPositionY || 50) / 100
          
          // 计算图片尺寸（基于较小的边）
          const baseSize = Math.min(width, height) * sizePercent
          imageWidth = baseSize
          imageHeight = baseSize
          
          // 计算位置（考虑图片尺寸，确保不超出边界）
          imageX = Math.max(0, Math.min(width - imageWidth, (width - imageWidth) * positionXPercent))
          imageY = Math.max(0, Math.min(height - imageHeight, (height - imageHeight) * positionYPercent))
          break
        default:
          patternWidth = patternHeight = 100
          imageX = imageY = 0
          imageWidth = imageHeight = 100
      }
      
      console.log('创建图片pattern，模式:', repeatMode, '尺寸:', { patternWidth, patternHeight, imageX, imageY, imageWidth, imageHeight })
      
      // 直接创建原生SVG pattern元素
      const svgNode = this.svg.node
      const defs = svgNode.querySelector('defs') || svgNode.appendChild(document.createElementNS('http://www.w3.org/2000/svg', 'defs'))
      
      // 创建pattern元素
      const pattern = document.createElementNS('http://www.w3.org/2000/svg', 'pattern')
      pattern.setAttribute('id', patternId)
      pattern.setAttribute('x', '0')
      pattern.setAttribute('y', '0')
      pattern.setAttribute('width', patternWidth.toString())
      pattern.setAttribute('height', patternHeight.toString())
      pattern.setAttribute('patternUnits', 'userSpaceOnUse')
      
      // 对于居中和自定义模式，添加透明背景
      if (repeatMode === 'center' || repeatMode === 'custom') {
        const bgRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect')
        bgRect.setAttribute('width', patternWidth.toString())
        bgRect.setAttribute('height', patternHeight.toString())
        bgRect.setAttribute('fill', 'transparent')
        pattern.appendChild(bgRect)
      }
      
      // 添加图片
      try {
        console.log('添加图片到pattern:', imageUrl.substring(0, 50))
        const image = document.createElementNS('http://www.w3.org/2000/svg', 'image')
        image.setAttribute('href', imageUrl)
        image.setAttribute('x', imageX.toString())
        image.setAttribute('y', imageY.toString())
        image.setAttribute('width', imageWidth.toString())
        image.setAttribute('height', imageHeight.toString())
        image.setAttribute('preserveAspectRatio', 'xMidYMid meet')
        pattern.appendChild(image)
        console.log('图片添加成功')
      } catch (error) {
        console.error('添加图片失败:', error)
        return ''
      }
      
      // 将pattern添加到defs中
      defs.appendChild(pattern)
      
      console.log('图片Pattern创建完成并添加到DOM:', patternId)
      console.log('Pattern元素:', pattern.outerHTML.substring(0, 300))
      
      return patternId
    } catch (error) {
      console.error('创建图片图案失败:', error)
      return ''
    }
  }

  private createTestPattern(repeatMode: string, width: number, height: number): string {
    const patternId = `test-pattern-${Date.now()}`
    
    // 根据重复模式设置pattern尺寸
    let patternWidth, patternHeight, testElementSize, testElementX, testElementY
    switch (repeatMode) {
      case 'tile':
        patternWidth = patternHeight = 100
        testElementSize = 90
        testElementX = testElementY = 5
        break
      case 'stretch':
        patternWidth = width
        patternHeight = height
        testElementSize = Math.min(width, height) * 0.9
        testElementX = (width - testElementSize) / 2
        testElementY = (height - testElementSize) / 2
        break
      case 'center':
        // 居中模式：pattern覆盖整个区域，测试元素居中显示
        patternWidth = width
        patternHeight = height
        testElementSize = Math.min(width, height) * 0.3
        testElementX = (width - testElementSize) / 2
        testElementY = (height - testElementSize) / 2
        break
      default:
        patternWidth = patternHeight = 100
        testElementSize = 90
        testElementX = testElementY = 5
    }
    
    console.log('创建测试图案，尺寸:', { patternWidth, patternHeight })
    
    try {
      // 直接创建原生SVG pattern元素
      const svgNode = this.svg.node
      const defs = svgNode.querySelector('defs') || svgNode.appendChild(document.createElementNS('http://www.w3.org/2000/svg', 'defs'))
      
      // 创建pattern元素
      const pattern = document.createElementNS('http://www.w3.org/2000/svg', 'pattern')
      pattern.setAttribute('id', patternId)
      pattern.setAttribute('x', '0')
      pattern.setAttribute('y', '0')
      pattern.setAttribute('width', patternWidth.toString())
      pattern.setAttribute('height', patternHeight.toString())
      pattern.setAttribute('patternUnits', 'userSpaceOnUse')
      
      // 对于居中和自定义模式，添加透明背景
      if (repeatMode === 'center' || repeatMode === 'custom') {
        const bgRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect')
        bgRect.setAttribute('width', patternWidth.toString())
        bgRect.setAttribute('height', patternHeight.toString())
        bgRect.setAttribute('fill', 'transparent')
        pattern.appendChild(bgRect)
      } else {
        // 其他模式添加背景矩形 - 使用更明显的颜色
        const bgRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect')
        bgRect.setAttribute('width', patternWidth.toString())
        bgRect.setAttribute('height', patternHeight.toString())
        bgRect.setAttribute('fill', '#ffeb3b')  // 明亮的黄色背景
        pattern.appendChild(bgRect)
      }
      
      // 添加明显的测试图形 - 大的彩色矩形
      const testRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect')
      testRect.setAttribute('x', testElementX.toString())
      testRect.setAttribute('y', testElementY.toString())
      testRect.setAttribute('width', testElementSize.toString())
      testRect.setAttribute('height', testElementSize.toString())
      testRect.setAttribute('fill', '#f44336')  // 明亮的红色
      testRect.setAttribute('stroke', '#000000')  // 黑色边框
      testRect.setAttribute('stroke-width', '2')
      pattern.appendChild(testRect)
      
      // 添加圆形
      const testCircle = document.createElementNS('http://www.w3.org/2000/svg', 'circle')
      testCircle.setAttribute('cx', (testElementX + testElementSize / 2).toString())
      testCircle.setAttribute('cy', (testElementY + testElementSize / 2).toString())
      testCircle.setAttribute('r', (testElementSize * 0.3).toString())
      testCircle.setAttribute('fill', '#2196f3')  // 明亮的蓝色
      testCircle.setAttribute('stroke', '#ffffff')  // 白色边框
      testCircle.setAttribute('stroke-width', '3')
      pattern.appendChild(testCircle)
      
      // 添加文字标识
      const text = document.createElementNS('http://www.w3.org/2000/svg', 'text')
      text.setAttribute('x', (testElementX + testElementSize / 2).toString())
      text.setAttribute('y', (testElementY + testElementSize / 2).toString())
      text.setAttribute('text-anchor', 'middle')
      text.setAttribute('dominant-baseline', 'middle')
      text.setAttribute('font-size', Math.max(12, testElementSize * 0.15).toString())
      text.setAttribute('fill', '#ffffff')
      text.setAttribute('font-weight', 'bold')
      text.setAttribute('stroke', '#000000')
      text.setAttribute('stroke-width', '1')
      text.textContent = 'TEST'
      pattern.appendChild(text)
      
      // 将pattern添加到defs中
      defs.appendChild(pattern)
      
      console.log('测试图案创建完成:', patternId)
      return patternId
    } catch (error) {
      console.error('创建测试图案失败:', error)
      return ''
    }
  }

  private addFileToPatternSync(file: File, patternElement: Element): void {
    console.log('向pattern添加文件内容:', { 
      fileName: file.name, 
      fileType: file.type, 
      fileSize: file.size 
    })
    
    try {
      const fileType = file.type.toLowerCase()
      
      if (fileType.includes('svg')) {
        console.log('处理SVG文件...')
        this.readFileAsText(file).then(svgContent => {
          console.log('SVG内容读取完成，长度:', svgContent?.length)
          if (svgContent) {
            const parser = new DOMParser()
            const svgDoc = parser.parseFromString(svgContent, 'image/svg+xml')
            const svgElement = svgDoc.querySelector('svg')
            
            if (svgElement && svgElement.innerHTML.trim()) {
              console.log('SVG解析成功，添加到pattern')
              const group = document.createElementNS('http://www.w3.org/2000/svg', 'g')
              group.setAttribute('transform', 'scale(0.8) translate(10, 10)')
              group.setAttribute('opacity', '0.8')
              
              const children = Array.from(svgElement.children)
              children.forEach(child => {
                const clonedChild = child.cloneNode(true) as Element
                group.appendChild(clonedChild)
              })
              
              patternElement.appendChild(group)
              console.log('SVG内容已成功添加到pattern')
            } else {
              console.error('SVG元素为空或无内容')
            }
          } else {
            console.error('SVG内容读取失败')
          }
        }).catch(error => {
          console.error('读取SVG文件失败:', error)
        })
      } else if (fileType.includes('image')) {
        console.log('处理图片文件...')
        this.readFileAsDataURL(file).then(imageUrl => {
          console.log('图片URL读取完成，长度:', imageUrl?.length)
          if (imageUrl) {
            console.log('创建图片元素并添加到pattern')
            const image = document.createElementNS('http://www.w3.org/2000/svg', 'image')
            image.setAttribute('href', imageUrl)
            image.setAttribute('x', '10')
            image.setAttribute('y', '10')
            image.setAttribute('width', '80')
            image.setAttribute('height', '80')
            image.setAttribute('opacity', '0.8')
            image.setAttribute('preserveAspectRatio', 'xMidYMid meet')
            patternElement.appendChild(image)
            console.log('图片已成功添加到pattern')
            
            // 验证图片是否真的添加了
            const images = patternElement.querySelectorAll('image')
            console.log('Pattern中的图片元素数量:', images.length)
          } else {
            console.error('图片URL读取失败')
          }
        }).catch(error => {
          console.error('读取图片文件失败:', error)
        })
      } else if (fileType.includes('pdf')) {
        console.log('PDF文件不支持直接显示，跳过')
      } else {
        console.log('不支持的文件类型:', fileType)
      }
    } catch (error) {
      console.error('添加文件内容到pattern失败:', error)
    }
  }

  private async addFileToPattern(file: File, patternId: string): Promise<void> {
    if (!patternId) return
    
    const patternElement = document.getElementById(patternId)
    if (!patternElement) {
      console.error('找不到pattern元素:', patternId)
      return
    }
    
    this.addFileToPatternSync(file, patternElement)
  }

  private addPatternText(x: number, y: number, width: number, height: number, config: PatternConfig) {
    // 在围裙中心添加图案说明文字
    this.svg.text(`图案: ${config.patternName}`)
      .move(x + width / 2, y + height / 2)
      .font({ size: 12, anchor: 'middle', family: 'Arial, sans-serif' })
      .fill('#666666')

    // 添加重复模式说明
    const modeMap: Record<string, string> = {
      'tile': '平铺重复',
      'stretch': '拉伸填充',
      'center': '居中显示',
      'custom': '自定义位置'
    }
    const modeText = modeMap[config.repeatMode] || config.repeatMode

    this.svg.text(`模式: ${modeText}`)
      .move(x + width / 2, y + height / 2 + 20)
      .font({ size: 10, anchor: 'middle', family: 'Arial, sans-serif' })
      .fill('#666666')
  }

  private readFileAsText(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = (e) => resolve(e.target?.result as string || '')
      reader.onerror = reject
      reader.readAsText(file)
    })
  }

  private readFileAsDataURL(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = (e) => resolve(e.target?.result as string || '')
      reader.onerror = reject
      reader.readAsDataURL(file)
    })
  }

  private async convertPDFToImage(file: File): Promise<string | null> {
    try {
      console.log('开始转换PDF到图片...')
      
      // 动态导入PDF.js
      const pdfjsLib = await import('pdfjs-dist')
      
      // 使用最新的worker配置方法
      console.log('设置PDF.js worker...')
      
      // 使用最新的推荐方法配置worker
      pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
        'pdfjs-dist/build/pdf.worker.min.mjs',
        import.meta.url
      ).toString()
      
      console.log('Worker设置完成，开始处理PDF文件...')
      
      // 读取PDF文件
      const arrayBuffer = await this.readFileAsArrayBuffer(file)
      console.log('PDF文件读取完成，大小:', arrayBuffer.byteLength)
      
      // 加载PDF文档
      const loadingTask = pdfjsLib.getDocument({
        data: arrayBuffer,
        verbosity: 0
      })
      
      const pdf = await loadingTask.promise
      console.log('PDF加载成功，页数:', pdf.numPages)
      
      // 获取第一页
      const page = await pdf.getPage(1)
      console.log('获取第一页成功')
      
      // 设置渲染参数
      const scale = 1.5
      const viewport = page.getViewport({ scale })
      console.log('页面尺寸:', viewport.width, 'x', viewport.height)
      
      // 创建canvas
      const canvas = document.createElement('canvas')
      const context = canvas.getContext('2d')
      canvas.height = viewport.height
      canvas.width = viewport.width
      
      if (!context) {
        throw new Error('无法创建canvas上下文')
      }
      
      // 渲染PDF页面到canvas
      const renderContext = {
        canvasContext: context,
        viewport: viewport
      }
      
      console.log('开始渲染PDF页面...')
      await page.render(renderContext).promise
      console.log('PDF页面渲染完成')
      
      // 将canvas转换为data URL
      const imageUrl = canvas.toDataURL('image/png', 0.8)
      console.log('PDF转换为图片成功')
      
      return imageUrl
    } catch (error) {
      console.error('PDF转换失败:', error)
      console.log('使用备选方案：专业PDF占位符')
      
      // 如果PDF渲染失败，返回专业占位符
      const fileName = file.name
      const fileSize = (file.size / 1024 / 1024).toFixed(2) + 'MB'
      return this.createProfessionalPDFPlaceholder(fileName, fileSize)
    }
  }

  private readFileAsArrayBuffer(file: File): Promise<ArrayBuffer> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = (e) => resolve(e.target?.result as ArrayBuffer)
      reader.onerror = reject
      reader.readAsArrayBuffer(file)
    })
  }

  private createPDFPlaceholder(): string {
    // 创建一个简单的PDF占位符图片
    const canvas = document.createElement('canvas')
    canvas.width = 400
    canvas.height = 300
    const ctx = canvas.getContext('2d')
    
    if (ctx) {
      // 绘制背景
      ctx.fillStyle = '#f5f5f5'
      ctx.fillRect(0, 0, 400, 300)
      
      // 绘制边框
      ctx.strokeStyle = '#cccccc'
      ctx.lineWidth = 2
      ctx.strokeRect(10, 10, 380, 280)
      
      // 绘制PDF图标
      ctx.fillStyle = '#ff4444'
      ctx.fillRect(150, 80, 100, 120)
      
      // 添加文字
      ctx.fillStyle = '#333333'
      ctx.font = '20px Arial'
      ctx.textAlign = 'center'
      ctx.fillText('PDF', 200, 150)
      ctx.font = '14px Arial'
      ctx.fillText('文档预览', 200, 180)
      ctx.fillText('(需要PDF.js支持)', 200, 220)
    }
    
    return canvas.toDataURL('image/png')
  }

  private createPDFPlaceholderWithInfo(fileName: string, fileSize: string): string {
    // 创建一个包含文件信息的PDF占位符图片
    const canvas = document.createElement('canvas')
    canvas.width = 500
    canvas.height = 350
    const ctx = canvas.getContext('2d')
    
    if (ctx) {
      // 绘制背景
      ctx.fillStyle = '#f8f9fa'
      ctx.fillRect(0, 0, 500, 350)
      
      // 绘制边框
      ctx.strokeStyle = '#dee2e6'
      ctx.lineWidth = 2
      ctx.strokeRect(10, 10, 480, 330)
      
      // 绘制PDF图标背景
      ctx.fillStyle = '#dc3545'
      ctx.fillRect(200, 60, 100, 120)
      
      // 绘制PDF图标细节
      ctx.fillStyle = '#ffffff'
      ctx.font = 'bold 24px Arial'
      ctx.textAlign = 'center'
      ctx.fillText('PDF', 250, 130)
      
      // 添加文件信息
      ctx.fillStyle = '#495057'
      ctx.font = '16px Arial'
      ctx.textAlign = 'center'
      
      // 文件名（如果太长则截断）
      const displayName = fileName.length > 30 ? fileName.substring(0, 27) + '...' : fileName
      ctx.fillText('文件名:', 250, 210)
      ctx.font = 'bold 14px Arial'
      ctx.fillText(displayName, 250, 230)
      
      // 文件大小
      ctx.font = '16px Arial'
      ctx.fillText('文件大小:', 250, 260)
      ctx.font = 'bold 14px Arial'
      ctx.fillText(fileSize, 250, 280)
      
      // 说明文字
      ctx.font = '12px Arial'
      ctx.fillStyle = '#6c757d'
      ctx.fillText('PDF文件已识别，将作为图案使用', 250, 310)
    }
    
    return canvas.toDataURL('image/png')
  }

  private createProfessionalPDFPlaceholder(fileName: string, fileSize: string): string {
    // 创建一个专业的PDF设计稿占位符
    const canvas = document.createElement('canvas')
    canvas.width = 600
    canvas.height = 400
    const ctx = canvas.getContext('2d')
    
    if (ctx) {
      // 绘制渐变背景
      const gradient = ctx.createLinearGradient(0, 0, 0, 400)
      gradient.addColorStop(0, '#f8f9fa')
      gradient.addColorStop(1, '#e9ecef')
      ctx.fillStyle = gradient
      ctx.fillRect(0, 0, 600, 400)
      
      // 绘制装饰性边框
      ctx.strokeStyle = '#6c757d'
      ctx.lineWidth = 3
      ctx.setLineDash([10, 5])
      ctx.strokeRect(15, 15, 570, 370)
      ctx.setLineDash([])
      
      // 绘制PDF图标 - 更专业的设计
      ctx.fillStyle = '#dc3545'
      ctx.fillRect(250, 80, 100, 130)
      
      // PDF图标阴影
      ctx.fillStyle = 'rgba(0,0,0,0.2)'
      ctx.fillRect(255, 85, 100, 130)
      
      // PDF图标主体
      ctx.fillStyle = '#dc3545'
      ctx.fillRect(250, 80, 100, 130)
      
      // PDF文字
      ctx.fillStyle = '#ffffff'
      ctx.font = 'bold 28px Arial'
      ctx.textAlign = 'center'
      ctx.fillText('PDF', 300, 155)
      
      // 装饰线条
      ctx.strokeStyle = '#ffffff'
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.moveTo(260, 170)
      ctx.lineTo(340, 170)
      ctx.stroke()
      
      // 主标题
      ctx.fillStyle = '#212529'
      ctx.font = 'bold 24px Arial'
      ctx.textAlign = 'center'
      ctx.fillText('PDF 设计文件', 300, 250)
      
      // 文件信息框
      ctx.fillStyle = 'rgba(255,255,255,0.9)'
      ctx.fillRect(100, 280, 400, 80)
      ctx.strokeStyle = '#dee2e6'
      ctx.lineWidth = 1
      ctx.strokeRect(100, 280, 400, 80)
      
      // 文件名
      ctx.fillStyle = '#495057'
      ctx.font = '16px Arial'
      ctx.textAlign = 'left'
      ctx.fillText('文件名:', 120, 305)
      
      const displayName = fileName.length > 35 ? fileName.substring(0, 32) + '...' : fileName
      ctx.font = 'bold 14px Arial'
      ctx.fillStyle = '#007bff'
      ctx.fillText(displayName, 120, 325)
      
      // 文件大小
      ctx.font = '16px Arial'
      ctx.fillStyle = '#495057'
      ctx.fillText('大小:', 120, 345)
      
      ctx.font = 'bold 14px Arial'
      ctx.fillStyle = '#28a745'
      ctx.fillText(fileSize, 170, 345)
      
      // 状态指示
      ctx.font = '12px Arial'
      ctx.fillStyle = '#6c757d'
      ctx.textAlign = 'center'
      ctx.fillText('✓ 文件已加载，可用作印花图案', 300, 380)
    }
    
    return canvas.toDataURL('image/png')
  }

  private drawStraps() {
    const startX = 30 * this.scale
    const startY = 40 * this.scale
    const topWidth = this.design.topWidth * this.scale
    const bottomWidth = this.design.bottomWidth * this.scale
    const topStartX = startX + (bottomWidth - topWidth) / 2

    // 根据颈带款式绘制不同的颈带
    this.drawNeckStrap(topStartX, startY, topWidth)
    
    // 腰带 - 只有在非交叉式时才绘制独立的腰带
    if (this.design.neckStrapStyle !== 'cross') {
      const waistY = startY + this.design.waistHeight * this.scale
      const waistStrapLength = this.design.waistStrap * this.scale
      
      // 腰带连接在围裙腰部和下部的分界线上（梯形底边的两端）
      const leftWaistX = startX
      const rightWaistX = startX + bottomWidth
      
      // 左腰带
      this.svg.line(leftWaistX, waistY, 
                    leftWaistX - waistStrapLength, waistY)
        .stroke('#8B4513')
        .attr('stroke-width', 6)
        .attr('stroke-linecap', 'round')
      
      // 右腰带
      this.svg.line(rightWaistX, waistY, 
                    rightWaistX + waistStrapLength, waistY)
        .stroke('#8B4513')
        .attr('stroke-width', 6)
        .attr('stroke-linecap', 'round')
    }
  }

  private drawNeckStrap(topStartX: number, startY: number, topWidth: number) {
    const neckStrapLength = this.design.neckStrap * this.scale
    const neckStrapHeight = 20 * this.scale
    
    switch (this.design.neckStrapStyle) {
      case 'classic':
        this.drawClassicNeckStrap(topStartX, startY, topWidth, neckStrapLength, neckStrapHeight)
        break
      case 'halter':
        this.drawHalterNeckStrap(topStartX, startY, topWidth, neckStrapLength, neckStrapHeight)
        break
      case 'cross':
        this.drawCrossNeckStrap(topStartX, startY, topWidth, neckStrapLength, neckStrapHeight)
        break
      case 'adjustable':
        this.drawAdjustableNeckStrap(topStartX, startY, topWidth, neckStrapLength, neckStrapHeight)
        break
      case 'tie':
        this.drawTieNeckStrap(topStartX, startY, topWidth, neckStrapLength, neckStrapHeight)
        break
      default:
        this.drawClassicNeckStrap(topStartX, startY, topWidth, neckStrapLength, neckStrapHeight)
    }
  }

  private drawClassicNeckStrap(topStartX: number, startY: number, topWidth: number, neckStrapLength: number, neckStrapHeight: number) {
    // 经典圆弧形颈带
    const leftNeckX = topStartX - neckStrapLength / 6
    const rightNeckX = topStartX + topWidth + neckStrapLength / 6
    const neckStrapTopY = startY - neckStrapHeight
    
    const neckStrapPath = `
      M ${topStartX} ${startY}
      Q ${leftNeckX} ${neckStrapTopY} ${topStartX + topWidth / 2} ${neckStrapTopY - 5 * this.scale}
      Q ${rightNeckX} ${neckStrapTopY} ${topStartX + topWidth} ${startY}
    `
    
    this.svg.path(neckStrapPath)
      .fill('none')
      .stroke('#8B4513')
      .attr('stroke-width', 6)
      .attr('stroke-linecap', 'round')
  }

  private drawHalterNeckStrap(topStartX: number, startY: number, topWidth: number, neckStrapLength: number, neckStrapHeight: number) {
    // 挂脖式颈带 - 两条带子汇聚到颈部中心
    const centerX = topStartX + topWidth / 2
    const neckCenterY = startY - neckStrapHeight - 10 * this.scale
    
    // 左侧带子
    this.svg.line(topStartX, startY, centerX - 5 * this.scale, neckCenterY)
      .stroke('#8B4513')
      .attr('stroke-width', 6)
      .attr('stroke-linecap', 'round')
    
    // 右侧带子
    this.svg.line(topStartX + topWidth, startY, centerX + 5 * this.scale, neckCenterY)
      .stroke('#8B4513')
      .attr('stroke-width', 6)
      .attr('stroke-linecap', 'round')
    
    // 颈部连接环
    this.svg.circle(8 * this.scale)
      .center(centerX, neckCenterY)
      .fill('none')
      .stroke('#8B4513')
      .attr('stroke-width', 3)
  }

  private drawCrossNeckStrap(topStartX: number, startY: number, topWidth: number, neckStrapLength: number, neckStrapHeight: number) {
    // 交叉式颈带 - 一根连续的带子穿过腰部孔洞形成腰带
    const centerX = topStartX + topWidth / 2
    const neckStrapTopY = startY - neckStrapHeight
    
    // 计算腰部位置
    const waistY = startY + this.design.waistHeight * this.scale
    const waistStrapLength = this.design.waistStrap * this.scale
    
    // 计算围裙边界
    const startX = 30 * this.scale
    const bottomWidth = this.design.bottomWidth * this.scale
    const leftWaistX = startX
    const rightWaistX = startX + bottomWidth
    
    // 腰部孔洞位置（在腰线上，距离边缘一定距离）
    const holeOffset = 15 * this.scale
    const leftHoleX = leftWaistX + holeOffset
    const rightHoleX = rightWaistX - holeOffset
    
    // 绘制连续的带子路径
    // 左侧：从围裙左上角到颈部中心
    this.svg.line(topStartX, startY, centerX - 10 * this.scale, neckStrapTopY)
      .stroke('#8B4513')
      .attr('stroke-width', 6)
      .attr('stroke-linecap', 'round')
    
    // 右侧：从围裙右上角到颈部中心
    this.svg.line(topStartX + topWidth, startY, centerX + 10 * this.scale, neckStrapTopY)
      .stroke('#8B4513')
      .attr('stroke-width', 6)
      .attr('stroke-linecap', 'round')
    
    // 颈部连接段
    this.svg.line(centerX - 10 * this.scale, neckStrapTopY, centerX + 10 * this.scale, neckStrapTopY)
      .stroke('#8B4513')
      .attr('stroke-width', 6)
      .attr('stroke-linecap', 'round')
    
    // 连续带子：从左上角穿过左侧腰部孔洞到左腰带
    this.svg.line(topStartX, startY, leftHoleX, waistY)
      .stroke('#8B4513')
      .attr('stroke-width', 4)
      .attr('stroke-linecap', 'round')
      .attr('stroke-dasharray', '5,3') // 虚线表示穿过围裙内部
    
    // 左腰带段
    this.svg.line(leftHoleX, waistY, leftWaistX - waistStrapLength, waistY)
      .stroke('#8B4513')
      .attr('stroke-width', 6)
      .attr('stroke-linecap', 'round')
    
    // 连续带子：从右上角穿过右侧腰部孔洞到右腰带
    this.svg.line(topStartX + topWidth, startY, rightHoleX, waistY)
      .stroke('#8B4513')
      .attr('stroke-width', 4)
      .attr('stroke-linecap', 'round')
      .attr('stroke-dasharray', '5,3') // 虚线表示穿过围裙内部
    
    // 右腰带段
    this.svg.line(rightHoleX, waistY, rightWaistX + waistStrapLength, waistY)
      .stroke('#8B4513')
      .attr('stroke-width', 6)
      .attr('stroke-linecap', 'round')
    
    // 绘制腰部孔洞
    this.svg.circle(8 * this.scale)
      .center(leftHoleX, waistY)
      .fill('none')
      .stroke('#333333')
      .attr('stroke-width', 2)
    
    this.svg.circle(8 * this.scale)
      .center(rightHoleX, waistY)
      .fill('none')
      .stroke('#333333')
      .attr('stroke-width', 2)
    
    // 添加孔洞标注
    this.svg.text('孔洞')
      .move(leftHoleX - 15 * this.scale, waistY - 20 * this.scale)
      .font({ size: 8, anchor: 'middle', family: 'Arial, sans-serif' })
      .fill('#666666')
    
    this.svg.text('孔洞')
      .move(rightHoleX + 15 * this.scale, waistY - 20 * this.scale)
      .font({ size: 8, anchor: 'middle', family: 'Arial, sans-serif' })
      .fill('#666666')
  }

  private drawAdjustableNeckStrap(topStartX: number, startY: number, topWidth: number, neckStrapLength: number, neckStrapHeight: number) {
    // 可调节颈带 - 带有扣环
    const leftNeckX = topStartX - neckStrapLength / 6
    const rightNeckX = topStartX + topWidth + neckStrapLength / 6
    const neckStrapTopY = startY - neckStrapHeight
    const centerX = topStartX + topWidth / 2
    
    // 左侧带子到扣环
    this.svg.line(topStartX, startY, centerX - 15 * this.scale, neckStrapTopY)
      .stroke('#8B4513')
      .attr('stroke-width', 6)
      .attr('stroke-linecap', 'round')
    
    // 右侧带子到扣环
    this.svg.line(topStartX + topWidth, startY, centerX + 15 * this.scale, neckStrapTopY)
      .stroke('#8B4513')
      .attr('stroke-width', 6)
      .attr('stroke-linecap', 'round')
    
    // 调节扣环
    this.svg.rect(30 * this.scale, 8 * this.scale)
      .center(centerX, neckStrapTopY)
      .fill('none')
      .stroke('#666666')
      .attr('stroke-width', 2)
      .rx(2 * this.scale)
    
    // 扣环内部细节
    this.svg.line(centerX - 10 * this.scale, neckStrapTopY, centerX + 10 * this.scale, neckStrapTopY)
      .stroke('#666666')
      .attr('stroke-width', 1)
  }

  private drawTieNeckStrap(topStartX: number, startY: number, topWidth: number, neckStrapLength: number, neckStrapHeight: number) {
    // 系带式颈带 - 柔软的带子末端
    const leftNeckX = topStartX - neckStrapLength / 4
    const rightNeckX = topStartX + topWidth + neckStrapLength / 4
    const neckStrapTopY = startY - neckStrapHeight
    
    // 左侧带子
    this.svg.line(topStartX, startY, leftNeckX, neckStrapTopY)
      .stroke('#8B4513')
      .attr('stroke-width', 6)
      .attr('stroke-linecap', 'round')
    
    // 右侧带子
    this.svg.line(topStartX + topWidth, startY, rightNeckX, neckStrapTopY)
      .stroke('#8B4513')
      .attr('stroke-width', 6)
      .attr('stroke-linecap', 'round')
    
    // 左侧带子末端（系带效果）
    this.svg.circle(4 * this.scale)
      .center(leftNeckX, neckStrapTopY)
      .fill('#8B4513')
    
    // 右侧带子末端（系带效果）
    this.svg.circle(4 * this.scale)
      .center(rightNeckX, neckStrapTopY)
      .fill('#8B4513')
    
    // 系带的飘带效果
    this.svg.line(leftNeckX, neckStrapTopY, leftNeckX - 8 * this.scale, neckStrapTopY + 12 * this.scale)
      .stroke('#8B4513')
      .attr('stroke-width', 3)
      .attr('stroke-linecap', 'round')
    
    this.svg.line(rightNeckX, neckStrapTopY, rightNeckX + 8 * this.scale, neckStrapTopY + 12 * this.scale)
      .stroke('#8B4513')
      .attr('stroke-width', 3)
      .attr('stroke-linecap', 'round')
  }

  private drawPocket() {
    const startX = 30 * this.scale
    const startY = 40 * this.scale
    const bottomWidth = this.design.bottomWidth * this.scale
    const waistHeight = this.design.waistHeight * this.scale
    const bottomHeight = this.design.bottomHeight * this.scale
    
    const pocketConfig = this.design.pocketConfig
    
    // 如果没有口袋配置，直接返回
    if (!pocketConfig || pocketConfig.mode === 'none') {
      return
    }
    
    switch (pocketConfig.mode) {
      case 'single':
        this.drawSinglePocket(startX, startY, bottomWidth, waistHeight, bottomHeight)
        break
      case 'double':
        this.drawDoublePockets(startX, startY, bottomWidth, waistHeight, bottomHeight)
        break
      case 'multiple':
        this.drawMultiplePockets(startX, startY, bottomWidth, waistHeight, bottomHeight)
        break
    }
  }

  private drawSinglePocket(startX: number, startY: number, bottomWidth: number, waistHeight: number, bottomHeight: number) {
    const config = this.design.pocketConfig.singlePocket
    if (!config) return
    
    const pocketWidth = config.width * this.scale
    const pocketHeight = config.height * this.scale
    
    // 计算口袋位置
    const pocketX = startX + (bottomWidth * config.positionX / 100) - (pocketWidth / 2)
    const pocketY = startY + waistHeight + (bottomHeight * config.positionY / 100) - (pocketHeight / 2)
    
    // 绘制口袋轮廓
    this.svg.rect(pocketWidth, pocketHeight)
      .move(pocketX, pocketY)
      .fill('none')
      .stroke('#333333')
      .attr('stroke-width', 1.5)
      .attr('stroke-dasharray', '4,2')
    
    // 添加口袋标注
    this.svg.text(`口袋: ${config.width}×${config.height}CM`)
      .move(pocketX, pocketY - 15)
      .font({ size: 9, family: 'Arial, sans-serif' })
      .fill('#666666')
  }

  private drawDoublePockets(startX: number, startY: number, bottomWidth: number, waistHeight: number, bottomHeight: number) {
    const config = this.design.pocketConfig.doublePockets
    if (!config) return
    
    const leftPocketWidth = config.leftPocket.width * this.scale
    const leftPocketHeight = config.leftPocket.height * this.scale
    const rightPocketWidth = config.rightPocket.width * this.scale
    const rightPocketHeight = config.rightPocket.height * this.scale
    const spacing = config.spacing * this.scale
    
    // 计算总宽度和起始位置
    const totalWidth = leftPocketWidth + spacing + rightPocketWidth
    const startPocketX = startX + (bottomWidth - totalWidth) / 2
    const pocketY = startY + waistHeight + (bottomHeight * config.positionY / 100) - Math.max(leftPocketHeight, rightPocketHeight) / 2
    
    // 绘制左口袋
    const leftPocketX = startPocketX
    this.svg.rect(leftPocketWidth, leftPocketHeight)
      .move(leftPocketX, pocketY)
      .fill('none')
      .stroke('#333333')
      .attr('stroke-width', 1.5)
      .attr('stroke-dasharray', '4,2')
    
    // 绘制右口袋
    const rightPocketX = startPocketX + leftPocketWidth + spacing
    this.svg.rect(rightPocketWidth, rightPocketHeight)
      .move(rightPocketX, pocketY)
      .fill('none')
      .stroke('#333333')
      .attr('stroke-width', 1.5)
      .attr('stroke-dasharray', '4,2')
    
    // 添加口袋标注
    this.svg.text(`左口袋: ${config.leftPocket.width}×${config.leftPocket.height}CM`)
      .move(leftPocketX, pocketY - 15)
      .font({ size: 9, family: 'Arial, sans-serif' })
      .fill('#666666')
    
    this.svg.text(`右口袋: ${config.rightPocket.width}×${config.rightPocket.height}CM`)
      .move(rightPocketX, pocketY - 15)
      .font({ size: 9, family: 'Arial, sans-serif' })
      .fill('#666666')
    
    // 添加间距标注
    this.svg.text(`间距: ${config.spacing}CM`)
      .move(leftPocketX + leftPocketWidth + spacing/2, pocketY + Math.max(leftPocketHeight, rightPocketHeight) + 10)
      .font({ size: 8, anchor: 'middle', family: 'Arial, sans-serif' })
      .fill('#999999')
  }

  private drawMultiplePockets(startX: number, startY: number, bottomWidth: number, waistHeight: number, bottomHeight: number) {
    const config = this.design.pocketConfig.multiplePockets
    if (!config) return
    
    const totalWidth = config.totalWidth * this.scale
    const pocketHeight = config.height * this.scale
    const pocketCount = config.count
    const singlePocketWidth = totalWidth / pocketCount
    
    // 计算起始位置
    const startPocketX = startX + (bottomWidth - totalWidth) / 2
    const pocketY = startY + waistHeight + (bottomHeight * config.positionY / 100) - (pocketHeight / 2)
    
    // 绘制每个口袋
    for (let i = 0; i < pocketCount; i++) {
      const pocketX = startPocketX + (i * singlePocketWidth)
      
      this.svg.rect(singlePocketWidth, pocketHeight)
        .move(pocketX, pocketY)
        .fill('none')
        .stroke('#333333')
        .attr('stroke-width', 1.5)
        .attr('stroke-dasharray', '4,2')
      
      // 如果不是最后一个口袋，绘制分隔线
      if (i < pocketCount - 1) {
        this.svg.line(pocketX + singlePocketWidth, pocketY, pocketX + singlePocketWidth, pocketY + pocketHeight)
          .stroke('#333333')
          .attr('stroke-width', 1)
          .attr('stroke-dasharray', '2,2')
      }
    }
    
    // 添加口袋标注
    this.svg.text(`${pocketCount}个口袋: 总宽${config.totalWidth}CM × 高${config.height}CM`)
      .move(startPocketX, pocketY - 15)
      .font({ size: 9, family: 'Arial, sans-serif' })
      .fill('#666666')
    
    this.svg.text(`单个口袋宽度: ${(config.totalWidth / pocketCount).toFixed(1)}CM`)
      .move(startPocketX, pocketY + pocketHeight + 10)
      .font({ size: 8, family: 'Arial, sans-serif' })
      .fill('#999999')
  }

  private addDimensions() {
    const startX = 30 * this.scale
    const startY = 40 * this.scale
    const topWidth = this.design.topWidth * this.scale
    const bottomWidth = this.design.bottomWidth * this.scale
    const waistHeight = this.design.waistHeight * this.scale
    const bottomHeight = this.design.bottomHeight * this.scale
    const totalHeight = this.design.totalHeight * this.scale
    
    const topStartX = startX + (bottomWidth - topWidth) / 2

    // 上沿宽度标注
    this.addDimensionLine(
      topStartX, startY - 10 * this.scale,
      topStartX + topWidth, startY - 10 * this.scale,
      `上沿: ${formatDimension(this.design.topWidth)}`,
      'horizontal'
    )

    // 下沿宽度标注
    this.addDimensionLine(
      startX, startY + totalHeight + 10 * this.scale,
      startX + bottomWidth, startY + totalHeight + 10 * this.scale,
      `下沿: ${formatDimension(this.design.bottomWidth)}`,
      'horizontal'
    )

    // 总高度标注
    this.addDimensionLine(
      startX - 15 * this.scale, startY,
      startX - 15 * this.scale, startY + totalHeight,
      `总高: ${formatDimension(this.design.totalHeight)}`,
      'vertical'
    )

    // 腰部高度标注
    this.addDimensionLine(
      startX + bottomWidth + 10 * this.scale, startY,
      startX + bottomWidth + 10 * this.scale, startY + waistHeight,
      `腰部: ${formatDimension(this.design.waistHeight)}`,
      'vertical'
    )

    // 下部高度标注
    this.addDimensionLine(
      startX + bottomWidth + 25 * this.scale, startY + waistHeight,
      startX + bottomWidth + 25 * this.scale, startY + totalHeight,
      `下部: ${formatDimension(this.design.bottomHeight)}`,
      'vertical'
    )
  }

  private addDimensionLine(x1: number, y1: number, x2: number, y2: number, text: string, direction: 'horizontal' | 'vertical') {
    // 绘制标注线
    this.svg.line(x1, y1, x2, y2)
      .stroke('#666666')
      .attr('stroke-width', 1)

    // 绘制箭头
    const arrowSize = 6
    if (direction === 'horizontal') {
      // 左箭头
      this.svg.polygon(`${x1},${y1} ${x1 + arrowSize},${y1 - arrowSize/2} ${x1 + arrowSize},${y1 + arrowSize/2}`)
        .fill('#666666')
      // 右箭头
      this.svg.polygon(`${x2},${y2} ${x2 - arrowSize},${y2 - arrowSize/2} ${x2 - arrowSize},${y2 + arrowSize/2}`)
        .fill('#666666')
      
      // 标注文字
      this.svg.text(text)
        .move((x1 + x2) / 2, y1 - 20)
        .font({ size: 11, anchor: 'middle', family: 'Arial, sans-serif' })
        .fill('#333333')
    } else {
      // 上箭头
      this.svg.polygon(`${x1},${y1} ${x1 - arrowSize/2},${y1 + arrowSize} ${x1 + arrowSize/2},${y1 + arrowSize}`)
        .fill('#666666')
      // 下箭头
      this.svg.polygon(`${x2},${y2} ${x2 - arrowSize/2},${y2 - arrowSize} ${x2 + arrowSize/2},${y2 - arrowSize}`)
        .fill('#666666')
      
      // 标注文字（旋转90度）
      this.svg.text(text)
        .move(x1 - 35, (y1 + y2) / 2)
        .font({ size: 11, anchor: 'middle', family: 'Arial, sans-serif' })
        .fill('#333333')
        .transform({ rotate: -90 })
    }
  }

  private addColorSpecification() {
    const canvasWidth = this.svg.width()
    const specY = 20

    if (this.design.colorConfig.type === 'solid') {
      const solidConfig = this.design.colorConfig as SolidColorConfig
      let colorText = `颜色: ${solidConfig.colorName}`
      
      if (solidConfig.pantoneCode) {
        colorText += ` (潘通: ${solidConfig.pantoneCode})`
      }
      
      // 颜色样本
      this.svg.rect(30, 20)
        .move(canvasWidth - 200, specY)
        .fill(solidConfig.hexValue)
        .stroke('#333333')
        .attr('stroke-width', 1)
      
      // 颜色文字说明
      this.svg.text(colorText)
        .move(canvasWidth - 160, specY + 5)
        .font({ size: 12, family: 'Arial, sans-serif' })
        .fill('#333333')
    } else {
      const patternConfig = this.design.colorConfig as PatternConfig
      
      // 印花说明
      this.svg.text(`印花图案: ${patternConfig.patternName}`)
        .move(canvasWidth - 200, specY)
        .font({ size: 12, family: 'Arial, sans-serif' })
        .fill('#333333')
      
      this.svg.text(`重复模式: ${patternConfig.repeatMode}`)
        .move(canvasWidth - 200, specY + 20)
        .font({ size: 10, family: 'Arial, sans-serif' })
        .fill('#666666')
    }
  }

  private addTitle() {
    const canvasWidth = this.svg.width()
    
    // 主标题
    this.svg.text('围裙设计稿')
      .move(canvasWidth / 2, 15)
      .font({ size: 18, anchor: 'middle', weight: 'bold', family: 'Arial, sans-serif' })
      .fill('#333333')

    // 副标题（设计参数摘要）
    const summary = `${this.design.topWidth}×${this.design.bottomWidth}×${this.design.totalHeight}CM`
    this.svg.text(summary)
      .move(canvasWidth / 2, 35)
      .font({ size: 12, anchor: 'middle', family: 'Arial, sans-serif' })
      .fill('#666666')
  }
} 