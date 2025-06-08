
'use server';

import { updateBotConfiguration, getBotConfiguration, updateCustomStrategyDoc, getCustomStrategyDoc } from '@/lib/firestoreService'; // getCustomStrategyDoc
import type { BotConfig, CustomStrategyDoc } from '@/types';
import { revalidatePath } from 'next/cache';

// This type will be used for the new consolidated save action
interface StrategyAndConfigData {
  pineScript: string;
  explanation: string;
  configToSave: BotConfig; // Includes all bot parameters and tradingEnabled status
}

export async function saveStrategyAndConfigurationAction(
  data: StrategyAndConfigData
): Promise<{ success: boolean; message: string }> {
  try {
    // 1. Save Pine Script and Explanation
    const strategyDoc: CustomStrategyDoc = {
      pineScript: data.pineScript,
      explanation: data.explanation,
    };
    const strategySaveResult = await updateCustomStrategyDoc(strategyDoc);
    if (!strategySaveResult.success) {
      return { success: false, message: strategySaveResult.message || 'Failed to save strategy document.' };
    }

    // 2. Save Bot Configuration (which includes tradingEnabled)
    // The configToSave object should be directly what Firestore expects for bot_config/main
    const botConfigSaveResult = await updateBotConfiguration(data.configToSave);
    if (!botConfigSaveResult.success) {
      // Rollback or log? For now, just report bot config save failure.
      return { success: false, message: botConfigSaveResult.message || 'Strategy document saved, but failed to save bot configuration.' };
    }
    
    revalidatePath('/'); // Revalidate relevant paths, especially for header bot status
    return { success: true, message: 'Strategy and bot configuration saved successfully!' };

  } catch (error: any) {
    console.error('Error in saveStrategyAndConfigurationAction:', error);
    return { success: false, message: error.message || 'An unexpected error occurred while saving.' };
  }
}


// The old saveBotConfigurationAction might still be useful if we ever need to save only bot config from elsewhere
// but for now, the new card will use saveStrategyAndConfigurationAction.
// We can deprecate or remove this if it's no longer directly called by any UI component.
// For now, keeping it as is but noting it's not used by the new StrategyDevelopmentCard.

export async function saveBotConfigurationAction(
  formData: FormData // This is kept for potential direct use, but new card won't use FormData this way
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


// saveCustomStrategyDocAction is effectively replaced by the first part of saveStrategyAndConfigurationAction
// Keeping it for now in case of direct use, but it's also not directly used by the new card.
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
