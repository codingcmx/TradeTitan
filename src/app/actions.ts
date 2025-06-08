
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
      const { targetSymbols, atrPeriod, stopLossMultiplier, takeProfitMultiplier } = data.configToSave;
      if (!targetSymbols || targetSymbols.length === 0) {
        // Save config but ensure tradingEnabled is false due to validation failure
        await updateBotConfiguration({ ...data.configToSave, tradingEnabled: false });
        return { success: false, message: 'Cannot enable trading: Target Symbols are required. Configuration saved with trading disabled.' };
      }
      if (atrPeriod === undefined || atrPeriod === null || isNaN(Number(atrPeriod))) {
        await updateBotConfiguration({ ...data.configToSave, tradingEnabled: false });
        return { success: false, message: 'Cannot enable trading: ATR Period is required and must be a number. Configuration saved with trading disabled.' };
      }
      if (stopLossMultiplier === undefined || stopLossMultiplier === null || isNaN(Number(stopLossMultiplier))) {
         await updateBotConfiguration({ ...data.configToSave, tradingEnabled: false });
        return { success: false, message: 'Cannot enable trading: Stop Loss Multiplier is required and must be a number. Configuration saved with trading disabled.' };
      }
      if (takeProfitMultiplier === undefined || takeProfitMultiplier === null || isNaN(Number(takeProfitMultiplier))) {
        await updateBotConfiguration({ ...data.configToSave, tradingEnabled: false });
        return { success: false, message: 'Cannot enable trading: Take Profit Multiplier is required and must be a number. Configuration saved with trading disabled.' };
      }
      // Add more checks as needed, e.g., for EMA periods if they are fundamental to all strategies your bot runs
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

    // 2. Save Bot Configuration (which includes tradingEnabled, potentially overridden to false by validation)
    const botConfigSaveResult = await updateBotConfiguration(data.configToSave);
    if (!botConfigSaveResult.success) {
      return { success: false, message: botConfigSaveResult.message || 'Strategy document saved, but failed to save bot configuration.' };
    }
    
    revalidatePath('/'); 
    revalidatePath('/dashboard'); // Assuming dashboard is the main page, adjust if needed
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
    };

    for (const key in newConfig) {
      const k = key as keyof BotConfig;
      if (newConfig[k] === undefined) {
        delete newConfig[k];
      }
      if ( (typeof newConfig[k] === 'number' && isNaN(newConfig[k] as number)) ) {
         delete newConfig[k]; 
      }
    }

    const result = await updateBotConfiguration(newConfig);

    if (result.success) {
      revalidatePath('/'); 
      const updatedConfig = await getBotConfiguration(); 
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

    