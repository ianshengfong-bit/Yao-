// A retried request can observe an existing or converted record, but never overwrite it.
export async function createCaptureOnce(runTransaction,db,ref,data,convertedRef=null) {
    return runTransaction(db,async tx=>{
        const existing=await tx.get(ref);
        const converted=convertedRef?await tx.get(convertedRef):null;
        if(existing.exists()||converted?.exists())return false;
        tx.set(ref,data);
        return true;
    });
}
