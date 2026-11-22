/* eslint-disable @typescript-eslint/no-explicit-any */
declare global {
  interface Window {
    kakao?: {
      maps: {
        load: (callback: () => void) => void;
        LatLng: new (lat: number, lng: number) => any;
        LatLngBounds: new () => {
          extend: (latlng: any) => void;
        };
        Map: new (container: HTMLElement, options: { center: any; level: number }) => any;
        Polyline: new (options: {
          path: any[];
          strokeWeight: number;
          strokeColor: string;
          strokeOpacity: number;
          strokeStyle?: string;
        }) => any;
        CustomOverlay: new (options: {
          position: any;
          content: string | HTMLElement;
          xAnchor?: number;
          yAnchor?: number;
          zIndex?: number;
        }) => any;
        ZoomControl: new () => any;
        MapTypeControl: new () => any;
        MapTypeId: {
          ROADMAP: any;
          SKYVIEW: any;
          HYBRID: any;
        };
        ControlPosition: {
          TOPRIGHT: any;
          RIGHT: any;
        };
        event: {
          addListener: (target: any, type: string, handler: (e?: any) => void) => void;
        };
      };
    };
  }
}

export {};
