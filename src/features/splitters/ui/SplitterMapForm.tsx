import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import {
  splitterMapFormSchema,
  type SplitterMapFormInputs,
} from '../schemas/splitterMapForm.schema'
import { useSplitterMapData } from '../hooks/useSplitterMapData'

interface SplitterMapFormProps {
  initialSplitterCode: string
  initialSplitterTitle: string
  initialLatitude: string
  initialLongitude: string
}

export function SplitterMapForm({
  initialSplitterCode,
  initialSplitterTitle,
  initialLatitude,
  initialLongitude,
}: SplitterMapFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors },
    setError,
  } = useForm<SplitterMapFormInputs>({
    resolver: zodResolver(splitterMapFormSchema),
    defaultValues: {
      mapName: '',
    },
  })

  const { state: splitterMapDataState, refetch } = useSplitterMapData({
    splitterCode: initialSplitterCode,
    splitterTitle: initialSplitterTitle,
    latitude: initialLatitude,
    longitude: initialLongitude,
    olt: null,
    clientPoints: [],
  })

  const onSubmit = async (data: SplitterMapFormInputs) => {
    setIsSubmitting(true)
    setSuccessMessage(null)

    try {
      await new Promise((resolve) => setTimeout(resolve, 1500))
      setSuccessMessage(`Mapa "${data.mapName}" criado com sucesso!`)
      refetch()
    } catch (error) {
      console.error('Erro ao enviar formul�rio:', error)
      setError('mapName', { type: 'manual', message: 'Erro ao criar o mapa.' })
    } finally {
      setIsSubmitting(false)
    }
  }

  const globalErrorMessage =
    splitterMapDataState.type === 'error' ? String(splitterMapDataState.error) : null

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      data-testid="splitter-map.form"
      className="space-y-4 rounded-md border p-4 shadow-sm"
    >
      {globalErrorMessage !== null && (
        <div
          data-testid="splitter-map.form.error-message"
          className="relative rounded border border-red-400 bg-red-100 dark:bg-red-950/50 px-4 py-3 text-red-700 dark:text-red-200"
          role="alert"
        >
          <strong className="font-bold">Erro:</strong>
          <span className="block sm:inline"> {globalErrorMessage}</span>
        </div>
      )}

      <div>
        <label htmlFor="mapName" className="block text-sm font-medium text-on-surface-variant">
          Nome do Mapa
        </label>
        <input
          type="text"
          id="mapName"
          {...register('mapName')}
          data-testid="splitter-map.input.name"
          className={`mt-1 block w-full rounded-md border p-2 shadow-sm ${errors.mapName ? 'border-red-500' : 'border-gray-300'}`}
        />
        {errors.mapName && (
          <p data-testid="splitter-map.input.name-error" className="mt-2 text-sm text-red-600 dark:text-red-300">
            {String(errors.mapName.message ?? '')}
          </p>
        )}
      </div>

      <button
        type="submit"
        data-testid="splitter-map.button.submit"
        disabled={isSubmitting}
        className="flex w-full justify-center rounded-md border border-transparent bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50"
      >
        {isSubmitting ? 'Enviando...' : 'Criar Mapa'}
      </button>

      {successMessage && (
        <div
          data-testid="splitter-map.form.success-message"
          className="relative rounded border border-green-400 bg-green-100 dark:bg-green-950/50 px-4 py-3 text-green-700 dark:text-green-200"
          role="alert"
        >
          <strong className="font-bold">Sucesso:</strong>
          <span className="block sm:inline"> {successMessage}</span>
        </div>
      )}
    </form>
  )
}


