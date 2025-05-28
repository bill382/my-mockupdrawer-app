'use client'

import { useState, useEffect, useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Slider } from '@/components/ui/slider'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Separator } from '@/components/ui/separator'
import { useApronDesignStore } from '@/store/apron-design'
import type { SolidColorConfig, PatternConfig } from '@/store/apron-design'
import { ApronSVGGenerator } from '@/lib/svg-generator'
import { ExportUtils } from '@/lib/export-utils'
import { 
	ChevronDown, 
	Download, 
	FileImage, 
	Package, 
	RefreshCw, 
	Palette,
	Upload,
	Calculator,
	Ruler,
	Settings
} from 'lucide-react'
import { toast } from 'sonner'

/**
 * @description 这只是个示例页面，你可以随意修改这个页面或进行全面重构
 */
export default function ApronDesignGenerator() {
	const { design, updateDesign, updateColorConfig, resetDesign, tempFile, setTempFile } = useApronDesignStore()
	const [svgContent, setSvgContent] = useState('')
	const [isExporting, setIsExporting] = useState(false)
	const [colorType, setColorType] = useState<'solid' | 'pattern'>(design.colorConfig.type)

	// 生成SVG预览
	const generatePreview = async () => {
		// 只在客户端生成SVG
		if (typeof window === 'undefined') {
			return ''
		}
		
		try {
			const generator = new ApronSVGGenerator(design, tempFile)
			return await generator.generate()
		} catch (error) {
			console.error('SVG生成失败:', error)
			return ''
		}
	}

	useEffect(() => {
		generatePreview().then(setSvgContent)
	}, [design, tempFile])

	// 处理纯色配置更新
	const handleSolidColorUpdate = (updates: Partial<SolidColorConfig>) => {
		const currentConfig = design.colorConfig.type === 'solid' 
			? design.colorConfig as SolidColorConfig 
			: { type: 'solid' as const, colorName: '珊瑚红', hexValue: '#FF6B6B' }
		
		updateColorConfig({
			...currentConfig,
			...updates
		})
	}

	// 处理印花配置更新
	const handlePatternUpdate = (updates: Partial<PatternConfig>) => {
		const currentConfig = design.colorConfig.type === 'pattern' 
			? design.colorConfig as PatternConfig 
			: { 
					type: 'pattern' as const, 
					file: null, 
					patternName: '自定义图案',
					repeatMode: 'tile' as const
				}
		
		updateColorConfig({
			...currentConfig,
			...updates
		})
	}

	// 处理颜色类型切换
	const handleColorTypeChange = (type: 'solid' | 'pattern') => {
		setColorType(type)
		
		if (type === 'solid') {
			updateColorConfig({
				type: 'solid',
				colorName: '珊瑚红',
				hexValue: '#FF6B6B'
			})
		} else {
			updateColorConfig({
				type: 'pattern',
				file: null,
				patternName: '自定义图案',
				repeatMode: 'tile'
			})
		}
	}

	// 处理文件上传
	const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
		const file = event.target.files?.[0]
		if (file) {
			// 验证文件类型
			const validTypes = ['image/svg+xml', 'application/pdf', 'image/png', 'image/jpeg', 'image/jpg']
			if (!validTypes.includes(file.type)) {
				toast.error('请上传SVG、PDF或图片文件')
				return
			}

			// 存储文件到tempFile
			setTempFile(file)
			handlePatternUpdate({
				file, // 仍然设置到colorConfig中，但会被persist排除
				patternName: file.name.replace(/\.[^/.]+$/, '') // 移除文件扩展名
			})
			toast.success('图案文件已上传')
		}
	}

	// 导出功能
	const handleExportSVG = async () => {
		if (!svgContent) {
			toast.error('请先生成设计稿')
			return
		}
		
		setIsExporting(true)
		try {
			await ExportUtils.exportSVG(svgContent)
			toast.success('SVG文件已下载')
		} catch (error) {
			toast.error('导出失败')
		} finally {
			setIsExporting(false)
		}
	}

	const handleExportPNG = async () => {
		if (!svgContent) {
			toast.error('请先生成设计稿')
			return
		}
		
		setIsExporting(true)
		try {
			await ExportUtils.exportPNG(svgContent)
			toast.success('PNG文件已下载')
		} catch (error) {
			toast.error('PNG导出失败')
		} finally {
			setIsExporting(false)
		}
	}

	const handleExportPackage = async () => {
		if (!svgContent) {
			toast.error('请先生成设计稿')
			return
		}
		
		setIsExporting(true)
		try {
			await ExportUtils.exportDesignPackage(svgContent, design)
			toast.success('设计包已下载')
		} catch (error) {
			toast.error('打包失败')
		} finally {
			setIsExporting(false)
		}
	}

	const handleReset = () => {
		resetDesign() // 这会同时清除tempFile
		setColorType('solid')
		toast.success('设计已重置')
	}

	return (
		<div className="min-h-screen bg-gray-50 p-4">
			<div className="mx-auto max-w-7xl">
				<div className="mb-6 text-center">
					<h1 className="text-3xl font-bold text-gray-900">围裙设计稿生成器</h1>
					<p className="mt-2 text-gray-600">专业的围裙设计工具，按照工业标准生成可编辑的设计稿</p>
				</div>

				<div className="grid gap-6 lg:grid-cols-2">
					{/* 左侧：设计表单 */}
					<div className="space-y-6">
						{/* 基础尺寸参数 */}
						<Card>
							<CardHeader>
								<CardTitle className="flex items-center gap-2">
									<Ruler className="h-5 w-5" />
									基础尺寸参数
								</CardTitle>
							</CardHeader>
							<CardContent className="space-y-4">
								<div className="grid grid-cols-2 gap-4">
									<div>
										<Label htmlFor="topWidth">围裙上沿宽度 (CM)</Label>
										<Input
											id="topWidth"
											type="number"
											value={design.topWidth}
											onChange={(e) => updateDesign({ topWidth: Number(e.target.value) })}
											min="20"
											max="80"
											step="0.5"
										/>
									</div>
									<div>
										<Label htmlFor="bottomWidth">围裙下沿宽度 (CM)</Label>
										<Input
											id="bottomWidth"
											type="number"
											value={design.bottomWidth}
											onChange={(e) => updateDesign({ bottomWidth: Number(e.target.value) })}
											min="30"
											max="120"
											step="0.5"
										/>
									</div>
								</div>

								<div>
									<Label htmlFor="totalHeight">围裙整体高度 (CM)</Label>
									<Input
										id="totalHeight"
										type="number"
										value={design.totalHeight}
										onChange={(e) => updateDesign({ totalHeight: Number(e.target.value) })}
										min="40"
										max="120"
										step="0.5"
									/>
								</div>

								<Separator />

								{/* 自动计算的尺寸 */}
								<div className="rounded-lg bg-blue-50 p-4">
									<div className="flex items-center gap-2 mb-2">
										<Calculator className="h-4 w-4 text-blue-600" />
										<span className="text-sm font-medium text-blue-900">自动计算尺寸</span>
									</div>
									<div className="grid grid-cols-2 gap-4 text-sm">
										<div>
											<span className="text-gray-600">围裙腰部高度:</span>
											<span className="ml-2 font-medium">{design.waistHeight} CM</span>
											<span className="text-xs text-gray-400 block">
												({((design.waistHeight / design.totalHeight) * 100).toFixed(1)}%)
											</span>
										</div>
										<div>
											<span className="text-gray-600">围裙下部高度:</span>
											<span className="ml-2 font-medium">{design.bottomHeight} CM</span>
											<span className="text-xs text-gray-400 block">
												({((design.bottomHeight / design.totalHeight) * 100).toFixed(1)}%)
											</span>
										</div>
									</div>
									<p className="text-xs text-gray-500 mt-2">
										* 腰部高度 = 整体高度 × 33%，下部高度 = 整体高度 - 腰部高度
									</p>
								</div>
							</CardContent>
						</Card>

						{/* 颜色规格配置 */}
						<Card>
							<CardHeader>
								<CardTitle className="flex items-center gap-2">
									<Palette className="h-5 w-5" />
									颜色规格配置
								</CardTitle>
							</CardHeader>
							<CardContent>
								<Tabs value={colorType} onValueChange={(value) => handleColorTypeChange(value as 'solid' | 'pattern')}>
									<TabsList className="grid w-full grid-cols-2">
										<TabsTrigger value="solid">纯色围裙</TabsTrigger>
										<TabsTrigger value="pattern">印花围裙</TabsTrigger>
									</TabsList>
									
									<TabsContent value="solid" className="space-y-4">
										<div>
											<Label htmlFor="colorName">颜色名称</Label>
											<Input
												id="colorName"
												value={design.colorConfig.type === 'solid' ? design.colorConfig.colorName : ''}
												onChange={(e) => handleSolidColorUpdate({ colorName: e.target.value })}
												placeholder="例如：珊瑚红、天蓝色"
											/>
										</div>
										
										<div>
											<Label htmlFor="pantoneCode">潘通色号 (可选)</Label>
											<Input
												id="pantoneCode"
												value={design.colorConfig.type === 'solid' ? design.colorConfig.pantoneCode || '' : ''}
												onChange={(e) => handleSolidColorUpdate({ pantoneCode: e.target.value })}
												placeholder="例如：PANTONE 18-1664 TPX"
											/>
										</div>
										
										<div>
											<Label htmlFor="hexValue">预览颜色</Label>
											<div className="flex gap-2">
												<Input
													id="hexValue"
													type="color"
													value={design.colorConfig.type === 'solid' ? design.colorConfig.hexValue : '#FF6B6B'}
													onChange={(e) => handleSolidColorUpdate({ hexValue: e.target.value })}
													className="w-16 h-10 p-1"
												/>
												<Input
													value={design.colorConfig.type === 'solid' ? design.colorConfig.hexValue : '#FF6B6B'}
													onChange={(e) => handleSolidColorUpdate({ hexValue: e.target.value })}
													placeholder="#FF6B6B"
													className="flex-1"
												/>
											</div>
										</div>
									</TabsContent>
									
									<TabsContent value="pattern" className="space-y-4">
										<div>
											<Label htmlFor="patternName">图案名称</Label>
											<Input
												id="patternName"
												value={design.colorConfig.type === 'pattern' ? design.colorConfig.patternName : ''}
												onChange={(e) => handlePatternUpdate({ patternName: e.target.value })}
												placeholder="例如：花卉图案、几何纹理"
											/>
										</div>
										
										<div>
											<Label htmlFor="patternFile">上传矢量图案文件</Label>
											<div className="flex items-center gap-2">
												<Input
													id="patternFile"
													type="file"
													accept=".svg,.pdf,.png,.jpg,.jpeg"
													onChange={handleFileUpload}
													className="flex-1"
												/>
												<Upload className="h-4 w-4 text-gray-400" />
											</div>
											<p className="text-xs text-gray-500 mt-1">
												支持 SVG、PDF、PNG、JPG 格式
											</p>
										</div>
										
										<div>
											<Label htmlFor="repeatMode">图案重复模式</Label>
											<Select
												value={design.colorConfig.type === 'pattern' ? design.colorConfig.repeatMode : 'tile'}
												onValueChange={(value: 'tile' | 'stretch' | 'center' | 'custom') => 
													handlePatternUpdate({ repeatMode: value })
												}
											>
												<SelectTrigger>
													<SelectValue />
												</SelectTrigger>
												<SelectContent>
													<SelectItem value="tile">平铺重复</SelectItem>
													<SelectItem value="stretch">拉伸填充</SelectItem>
													<SelectItem value="center">居中显示</SelectItem>
													<SelectItem value="custom">自定义位置和大小</SelectItem>
												</SelectContent>
											</Select>
										</div>

										{/* 自定义模式的控制面板 */}
										{design.colorConfig.type === 'pattern' && design.colorConfig.repeatMode === 'custom' && (
											<div className="space-y-4 p-4 bg-blue-50 rounded-lg">
												<div className="flex items-center gap-2 mb-2">
													<Settings className="h-4 w-4 text-blue-600" />
													<span className="text-sm font-medium text-blue-900">自定义图案设置</span>
												</div>
												
												<div>
													<Label htmlFor="customSize">图案大小 (%)</Label>
													<div className="flex items-center gap-2">
														<Input
															id="customSize"
															type="range"
															min="10"
															max="100"
															step="5"
															value={design.colorConfig.customSize || 30}
															onChange={(e) => handlePatternUpdate({ customSize: Number(e.target.value) })}
															className="flex-1"
														/>
														<span className="text-sm font-medium w-12">
															{design.colorConfig.customSize || 30}%
														</span>
													</div>
													<p className="text-xs text-gray-500 mt-1">
														图案相对于围裙区域的大小
													</p>
												</div>
												
												<div>
													<Label htmlFor="customPositionX">水平位置 (%)</Label>
													<div className="flex items-center gap-2">
														<Input
															id="customPositionX"
															type="range"
															min="0"
															max="100"
															step="5"
															value={design.colorConfig.customPositionX || 50}
															onChange={(e) => handlePatternUpdate({ customPositionX: Number(e.target.value) })}
															className="flex-1"
														/>
														<span className="text-sm font-medium w-12">
															{design.colorConfig.customPositionX || 50}%
														</span>
													</div>
													<p className="text-xs text-gray-500 mt-1">
														0% = 左边，50% = 居中，100% = 右边
													</p>
												</div>
												
												<div>
													<Label htmlFor="customPositionY">垂直位置 (%)</Label>
													<div className="flex items-center gap-2">
														<Input
															id="customPositionY"
															type="range"
															min="0"
															max="100"
															step="5"
															value={design.colorConfig.customPositionY || 50}
															onChange={(e) => handlePatternUpdate({ customPositionY: Number(e.target.value) })}
															className="flex-1"
														/>
														<span className="text-sm font-medium w-12">
															{design.colorConfig.customPositionY || 50}%
														</span>
													</div>
													<p className="text-xs text-gray-500 mt-1">
														0% = 顶部，50% = 居中，100% = 底部
													</p>
												</div>
											</div>
										)}
									</TabsContent>
								</Tabs>
							</CardContent>
						</Card>

						{/* 绑带参数 */}
						<Card>
							<CardHeader>
								<CardTitle>绑带参数 (使用模板默认值)</CardTitle>
							</CardHeader>
							<CardContent className="space-y-4">
								<div className="grid grid-cols-2 gap-4">
									<div>
										<Label htmlFor="neckStrap">颈带长度 (CM)</Label>
										<Input
											id="neckStrap"
											type="number"
											value={design.neckStrap}
											onChange={(e) => updateDesign({ neckStrap: Number(e.target.value) })}
											min="30"
											max="80"
										/>
									</div>
									<div>
										<Label htmlFor="waistStrap">腰带长度 (CM)</Label>
										<Input
											id="waistStrap"
											type="number"
											value={design.waistStrap}
											onChange={(e) => updateDesign({ waistStrap: Number(e.target.value) })}
											min="50"
											max="120"
										/>
									</div>
								</div>
							</CardContent>
						</Card>

						{/* 操作按钮 */}
						<Card>
							<CardHeader>
								<CardTitle>导出设计稿</CardTitle>
							</CardHeader>
							<CardContent>
								<div className="grid grid-cols-2 gap-4">
									<Button 
										onClick={handleExportSVG} 
										disabled={isExporting}
										className="w-full"
									>
										<FileImage className="mr-2 h-4 w-4" />
										导出 SVG
									</Button>
									<Button 
										onClick={handleExportPNG} 
										disabled={isExporting}
										variant="outline"
										className="w-full"
									>
										<Download className="mr-2 h-4 w-4" />
										导出 PNG
									</Button>
								</div>
								<Button 
									onClick={handleExportPackage} 
									disabled={isExporting}
									variant="secondary"
									className="w-full mt-2"
								>
									<Package className="mr-2 h-4 w-4" />
									导出完整设计包
								</Button>
								<Separator className="my-4" />
								<Button 
									onClick={handleReset} 
									variant="destructive"
									className="w-full"
								>
									<RefreshCw className="mr-2 h-4 w-4" />
									重置设计
								</Button>
							</CardContent>
						</Card>
					</div>

					{/* 右侧：SVG预览 */}
					<div className="space-y-6">
						<Card>
							<CardHeader>
								<CardTitle>设计稿预览</CardTitle>
							</CardHeader>
							<CardContent>
								<div className="border rounded-lg bg-white p-4 min-h-[600px] flex items-center justify-center">
									{svgContent ? (
										<div 
											dangerouslySetInnerHTML={{ __html: svgContent }}
											className="max-w-full max-h-full overflow-auto"
										/>
									) : (
										<div className="text-center text-gray-500">
											<Palette className="mx-auto h-12 w-12 mb-4 opacity-50" />
											<p>设计稿生成中...</p>
										</div>
									)}
								</div>
							</CardContent>
						</Card>
					</div>
				</div>
			</div>
		</div>
	)
}

