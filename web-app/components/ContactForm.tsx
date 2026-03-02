import { useState } from 'react'

export default function ContactForm(){
  const [state, setState] = useState({businessName:'',address:'',nif:'',contactEmail:'',password:''});
  const [status, setStatus] = useState<string | null>(null);

  const handleSubmit = async (e: any) => {
    e.preventDefault();
    setStatus('Creant compte de bar...');
    try {
      const res = await fetch('/api/register-bar',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(state)});
      const json = await res.json();
      if (json?.ok){ 
        setStatus('Compte creat correctament! Revisa el teu email.'); 
        setState({businessName:'',address:'',nif:'',contactEmail:'',password:''}); 
      }
      else setStatus('Error: '+(json?.error||'Desconegut'));
    }catch(err:any){ setStatus('Error: '+err?.message); }
  }

  return (
    <form onSubmit={handleSubmit} className="panel" style={{background: '#fff', padding: 32, borderRadius: 16, boxShadow: '0 10px 30px rgba(0,0,0,0.08)'}}>
      <h3 style={{marginTop: 0, marginBottom: 24}}>Crea el teu compte de Bar</h3>
      <div style={{display:'grid',gap:16}}>
        <label style={{fontWeight: 600, fontSize: 14}}>Nom del local<input required value={state.businessName} onChange={e=>setState(s=>({...s,businessName:e.target.value}))} style={{width:'100%',padding:12, marginTop: 6, borderRadius: 8, border: '1px solid #ccc'}}/></label>
        <label style={{fontWeight: 600, fontSize: 14}}>Adreça<input required value={state.address} onChange={e=>setState(s=>({...s,address:e.target.value}))} style={{width:'100%',padding:12, marginTop: 6, borderRadius: 8, border: '1px solid #ccc'}}/></label>
        <label style={{fontWeight: 600, fontSize: 14}}>NIF<input required value={state.nif} onChange={e=>setState(s=>({...s,nif:e.target.value}))} style={{width:'100%',padding:12, marginTop: 6, borderRadius: 8, border: '1px solid #ccc'}}/></label>
        <label style={{fontWeight: 600, fontSize: 14}}>Email de contacte<input required type="email" value={state.contactEmail} onChange={e=>setState(s=>({...s,contactEmail:e.target.value}))} style={{width:'100%',padding:12, marginTop: 6, borderRadius: 8, border: '1px solid #ccc'}}/></label>
        <label style={{fontWeight: 600, fontSize: 14}}>Contrasenya<input required type="password" value={state.password} onChange={e=>setState(s=>({...s,password:e.target.value}))} style={{width:'100%',padding:12, marginTop: 6, borderRadius: 8, border: '1px solid #ccc'}}/></label>
        
        <button type="submit" style={{background: 'var(--text)', color: '#fff', padding: '14px', borderRadius: '8px', fontWeight: 'bold', border: 'none', cursor: 'pointer', marginTop: 8}}>Registrar Bar</button>
        
        {status && <div style={{color: status.includes('Error') ? 'red' : 'green', fontWeight: 600, marginTop: 8}}>{status}</div>}
      </div>
    </form>
  )
}
