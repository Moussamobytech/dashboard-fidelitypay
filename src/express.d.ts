declare module 'express' {
    export interface Request {
        [key: string]: any;
        query: any;
        params: any;
        body: any;
    }
    export interface Response {
        [key: string]: any;
        send(body: any): Response;
        json(body: any): Response;
        status(code: number): Response;
    }
    export interface NextFunction {
        (err?: any): void;
    }

    function express(): any;
    namespace express {
        export function static(root: string, options?: any): any;
    }
    export default express;
}
