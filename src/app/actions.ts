
'use server';

import { updateBotConfiguration, getBotConfiguration } from '@/lib/firestoreService';
import type { BotConfig } from '@/types';
import { revalidatePath } from 'next/cache';

export async function saveBotConfigurationAction(
  formData: FormData
): Promise<{ success: boolean; message: string; updatedConfig?: BotConfig }> {
  try {
    // Construct the config object from FormData
    const newConfig: Partial<BotConfig> = {
      targetSymbols: formData.get('targetSymbols') ? (formData.get('targetSymbols') as string).split(',').map(s => s.trim()).filter(Boolean) : [],
      emaShortPeriod: formData.get('emaShortPeriod') ? Number(formData.get('emaShortPeriod')) : undefined,
      emaMediumPeriod: formData.get('emaMediumPeriod') ? Number(formData.get('emaMediumPeriod')) : undefined,
      emaLongPeriod: formData.get('emaLongPeriod') ? Number(formData.get('emaLongPeriod')) : undefined,
      atrPeriod: formData.get('atrPeriod') ? Number(formData.get('atrPeriod')) : undefined,
      stopLossMultiplier: formData.get('stopLossMultiplier') ? Number(formData.get('stopLossMultiplier')) : undefined,
      takeProfitMultiplier: formData.get('takeProfitMultiplier') ? Number(formData.get('takeProfitMultiplier')) : undefined,
      tradingEnabled: formData.get('tradingEnabled') === 'on', // Checkbox value is 'on' or null
    };

    // Filter out undefined values more carefully, allow deletion of fields if empty string was passed for numbers
    for (const key in newConfig) {
      const k = key as keyof BotConfig;
      if (newConfig[k] === undefined) {
        delete newConfig[k];
      }
      if ( (typeof newConfig[k] === 'number' && isNaN(newConfig[k] as number)) ) {
         delete newConfig[k]; // Remove if it resulted in NaN
      }
    }


    const result = await updateBotConfiguration(newConfig);

    if (result.success) {
      // Revalidate the path where BotConfigCard is displayed to show updated data
      revalidatePath('/src/app/page'); // Adjust the path if your page is different
      revalidatePath('/'); // Revalidate root as well
      const updatedConfig = await getBotConfiguration(); // Fetch the latest config to return
      return { success: true, message: 'Configuration saved successfully!', updatedConfig };
    } else {
      return { success: false, message: result.message || 'Failed to save configuration.' };
    }
  } catch (error: any) {
    console.error('Error in saveBotConfigurationAction:', error);
    return { success: false, message: error.message || 'An unexpected error occurred.' };
  }
}
