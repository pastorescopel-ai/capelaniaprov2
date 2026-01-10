
import { User, BibleStudy, BibleClass, SmallGroup, StaffVisit, Config, MasterLists } from '../types';

class SyncService {
  private scriptUrl: string = '';

  setScriptUrl(url: string) {
    this.scriptUrl = url;
  }

  async syncFromCloud() {
    if (!this.scriptUrl) return null;
    try {
      const response = await fetch(this.scriptUrl, {
        method: 'POST',
        body: JSON.stringify({ action: 'sync' }),
      });
      const data = await response.json();
      
      // Parse JSON strings back to arrays/objects
      if (data.masterLists) {
        Object.keys(data.masterLists).forEach(key => {
          if (typeof data.masterLists[key] === 'string' && data.masterLists[key].startsWith('[')) {
            data.masterLists[key] = JSON.parse(data.masterLists[key]);
          }
        });
      }
      
      if (data.bibleClasses) {
        data.bibleClasses.forEach((item: any) => {
          if (typeof item.students === 'string') item.students = JSON.parse(item.students);
        });
      }

      return data;
    } catch (error) {
      console.error('Cloud Sync Error:', error);
      return null;
    }
  }

  async saveToCloud(payload: any) {
    if (!this.scriptUrl) return false;
    try {
      const response = await fetch(this.scriptUrl, {
        method: 'POST',
        body: JSON.stringify({ action: 'save', ...payload }),
      });
      const result = await response.json();
      return result.status === 'success';
    } catch (error) {
      console.error('Cloud Save Error:', error);
      return false;
    }
  }

  getLocal<T>(key: string): T | null {
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : null;
  }

  setLocal(key: string, data: any) {
    localStorage.setItem(key, JSON.stringify(data));
  }
}

export const syncService = new SyncService();
