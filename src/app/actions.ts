
'use server';

import { updateBotConfiguration, getBotConfiguration, updateCustomStrategyDoc, getCustomStrategyDoc } from '@/lib/firestoreService';
import type { BotConfig, CustomStrategyDoc } from '@/types';
import { revalidatePath } from 'next/cache';

interface StrategyAndConfigData {
  pineScript: string;
  explanation: string;
  configToSave: BotConfig;
}

export async function saveStrategyAndConfigurationAction(
  data: StrategyAndConfigData
): Promise<{ success: boolean; message: string }> {
  try {
    // Validate essential parameters if trading is being enabled
    if (data.configToSave.tradingEnabled) {
      const { targetSymbols, atrPeriod, stopLossMultiplier, takeProfitMultiplier, timeframe } = data.configToSave; // tradeAmountUSD removed from validation
      let errors = [];
      if (!targetSymbols || targetSymbols.length === 0) {
        errors.push('Target Symbols are required.');
      }
      if (!timeframe) {
        errors.push('Trading Timeframe is required.');
      }
      // tradeAmountUSD validation removed
      if (atrPeriod === undefined || atrPeriod === null || isNaN(Number(atrPeriod))) {
        errors.push('ATR Period is required and must be a number.');
      }
      if (stopLossMultiplier === undefined || stopLossMultiplier === null || isNaN(Number(stopLossMultiplier))) {
        errors.push('Stop Loss Multiplier is required and must be a number.');
      }
      if (takeProfitMultiplier === undefined || takeProfitMultiplier === null || isNaN(Number(takeProfitMultiplier))) {
        errors.push('Take Profit Multiplier is required and must be a number.');
      }

      if (errors.length > 0) {
        // Save the configuration but force tradingEnabled to false
        await updateBotConfiguration({ ...data.configToSave, tradingEnabled: false });
        return { success: false, message: `Cannot enable trading: ${errors.join(' ')} Configuration saved with trading disabled.` };
      }
    }

    // 1. Save Pine Script and Explanation
    const strategyDoc: CustomStrategyDoc = {
      pineScript: data.pineScript,
      explanation: data.explanation,
    };
    const strategySaveResult = await updateCustomStrategyDoc(strategyDoc);
    if (!strategySaveResult.success) {
      return { success: false, message: strategySaveResult.message || 'Failed to save strategy document.' };
    }

    // 2. Save Bot Configuration
    const botConfigSaveResult = await updateBotConfiguration(data.configToSave);
    if (!botConfigSaveResult.success) {
      // If bot config save fails, the strategy doc was still saved.
      // This could be handled differently, e.g., by trying to roll back the strategy doc save,
      // but for now, we'll report the partial success/failure.
      return { success: false, message: botConfigSaveResult.message || 'Strategy document saved, but failed to save bot configuration.' };
    }

    revalidatePath('/'); // Revalidate the main page or specific dashboard paths
    revalidatePath('/dashboard'); // If you have a /dashboard route
    return { success: true, message: 'Strategy and bot configuration saved successfully!' };

  } catch (error: any) {
    console.error('Error in saveStrategyAndConfigurationAction:', error);
    return { success: false, message: error.message || 'An unexpected error occurred while saving.' };
  }
}


// Deprecated actions below, kept for reference but should be removed if no longer used.

export async function saveBotConfigurationAction(
  formData: FormData
): Promise<{ success: boolean; message: string; updatedConfig?: BotConfig }> {
  try {
    const newConfig: Partial<BotConfig> = {
      targetSymbols: formData.get('targetSymbols') ? (formData.get('targetSymbols') as string).split(',').map(s => s.trim()).filter(Boolean) : [],
      emaShortPeriod: formData.get('emaShortPeriod') ? Number(formData.get('emaShortPeriod')) : undefined,
      emaMediumPeriod: formData.get('emaMediumPeriod') ? Number(formData.get('emaMediumPeriod')) : undefined,
      emaLongPeriod: formData.get('emaLongPeriod') ? Number(formData.get('emaLongPeriod')) : undefined,
      atrPeriod: formData.get('atrPeriod') ? Number(formData.get('atrPeriod')) : undefined,
      stopLossMultiplier: formData.get('stopLossMultiplier') ? Number(formData.get('stopLossMultiplier')) : undefined,
      takeProfitMultiplier: formData.get('takeProfitMultiplier') ? Number(formData.get('takeProfitMultiplier')) : undefined,
      tradingEnabled: formData.get('tradingEnabled') === 'on',
      timeframe: formData.get('timeframe') as string || undefined,
      // tradeAmountUSD removed
    };

    // Clean up undefined or NaN numeric fields
    for (const key in newConfig) {
      const k = key as keyof BotConfig;
      if (newConfig[k] === undefined) {
        delete newConfig[k];
      }
      if ( (typeof newConfig[k] === 'number' && isNaN(newConfig[k] as number)) ) {
         delete newConfig[k]; // Remove if it's NaN
      }
    }

    const result = await updateBotConfiguration(newConfig);

    if (result.success) {
      revalidatePath('/');
      const updatedConfig = await getBotConfiguration(); // Fetch the potentially modified config
      return { success: true, message: 'Configuration saved successfully!', updatedConfig };
    } else {
      return { success: false, message: result.message || 'Failed to save configuration.' };
    }
  } catch (error: any) {
    console.error('Error in saveBotConfigurationAction:', error);
    return { success: false, message: error.message || 'An unexpected error occurred.' };
  }
}

export async function saveCustomStrategyDocAction(
  formData: FormData
): Promise<{ success: boolean; message: string; updatedDoc?: CustomStrategyDoc }> {
  try {
    const strategyDoc: CustomStrategyDoc = {
      pineScript: formData.get('pineScript') as string || '',
      explanation: formData.get('explanation') as string || '',
    };

    const result = await updateCustomStrategyDoc(strategyDoc);

    if (result.success) {
      revalidatePath('/');
      return { success: true, message: 'Strategy document saved successfully!', updatedDoc: strategyDoc };
    } else {
      return { success: false, message: result.message || 'Failed to save strategy document.' };
    }
  } catch (error: any) {
    console.error('Error in saveCustomStrategyDocAction:', error);
    return { success: false, message: error.message || 'An unexpected error occurred.' };
  }
}
