import BrandLogo from "./BrandLogo";
export default function HeroVisual() {
  return <div className="hero-visual" aria-hidden="true">
    <div className="hero-halo"/><div className="brand-orbit brand-orbit-one"/><div className="brand-orbit brand-orbit-two"/><div className="brand-orbit brand-orbit-three"/>
    <span className="orbit-point orbit-point-one"/><span className="orbit-point orbit-point-two"/><span className="orbit-point orbit-point-three"/>
    <BrandLogo large/><span className="orbit-dust dust-one"/><span className="orbit-dust dust-two"/><span className="orbit-dust dust-three"/>
  </div>;
}
